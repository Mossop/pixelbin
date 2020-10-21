import Knex from "knex";

import { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode, notfound } from "./error";
import { uuid } from "./id";
import { drop, from, insert, update, withChildren } from "./queries";
import { Table, Tables, ref, nameConstraint, intoAPITypes, intoDBTypes } from "./types";
import { ensureUserTransaction } from "./utils";

export async function listStorage(this: UserScopedConnection): Promise<Tables.Storage[]> {
  return from(this.knex, Table.Storage)
    .where(ref(Table.Storage, "user"), this.user)
    .select(ref(Table.Storage));
}

export async function createStorage(
  this: UserScopedConnection,
  data: Omit<Tables.Storage, "id" | "user">,
): Promise<Tables.Storage> {
  let results = await insert(this.knex, Table.Storage, {
    ...data,
    id: await uuid("S"),
    user: this.user,
  }).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Storage record.");
}

export async function listCatalogs(this: UserScopedConnection): Promise<Tables.Catalog[]> {
  let results = await from(this.knex, Table.Catalog)
    .whereIn(ref(Table.Catalog, "id"), this.catalogs())
    .select<Tables.Catalog[]>(ref(Table.Catalog));
  return results.map(intoAPITypes);
}

export const createCatalog = ensureUserTransaction(async function createCatalog(
  this: UserScopedConnection,
  data: Omit<Tables.Catalog, "id">,
): Promise<Tables.Catalog> {
  let ids = await this.knex.from(Table.Storage)
    .where({
      user: this.user,
      id: data.storage,
    })
    .select("id");

  if (ids.length != 1) {
    notfound(Table.Storage);
  }

  let results = await insert(this.knex, Table.Catalog, {
    ...intoDBTypes(data),
    id: await uuid("C"),
    storage: data.storage,
  }).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Catalog record.");
  }

  return results[0];
});

export async function listAlbums(this: UserScopedConnection): Promise<Tables.Album[]> {
  let results = await from(this.knex, Table.Album)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Album, "catalog"))
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select<Tables.Album[]>(ref(Table.Album));
  return results.map(intoAPITypes);
}

export async function listMediaInCatalog(
  this: UserScopedConnection,
  id: Tables.Catalog["id"],
): Promise<Tables.StoredMediaDetail[]> {
  await this.checkRead(Table.Catalog, [id]);

  return from(this.knex, Table.StoredMediaDetail)
    .andWhere(ref(Table.StoredMediaDetail, "catalog"), id)
    .select(ref(Table.StoredMediaDetail));
}

export const createAlbum = ensureUserTransaction(async function createAlbum(
  this: UserScopedConnection,
  catalog: Tables.Album["catalog"],
  data: Omit<Tables.Album, "id" | "catalog">,
): Promise<Tables.Album> {
  await this.checkWrite(Table.Catalog, [catalog]);

  let results = await insert(this.knex, Table.Album, {
    ...intoDBTypes(data),
    id: await uuid("A"),
    catalog,
  }).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Album record.");
  }

  return results[0];
});

export const editAlbum = ensureUserTransaction(async function editAlbum(
  this: UserScopedConnection,
  id: Tables.Album["id"],
  data: Partial<Tables.Album>,
): Promise<Tables.Album> {
  await this.checkWrite(Table.Album, [id]);

  let {
    id: removedId,
    catalog: removedCatalog,
    ...albumUpdateData
  } = data;
  let results = await update(
    Table.Album,
    this.knex.where("id", id),
    intoDBTypes(albumUpdateData),
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Album record.");
  }

  return intoAPITypes(results[0]);
});

export const deleteAlbums = ensureUserTransaction(async function deleteAlbums(
  this: UserScopedConnection,
  ids: Tables.Album["id"][],
): Promise<void> {
  await this.checkWrite(Table.Album, ids);

  await drop(this.knex, Table.Album)
    .whereIn(ref(Table.Album, "id"), ids);
});

export const listMediaInAlbum = ensureUserTransaction(async function listMediaInAlbum(
  this: UserScopedConnection,
  id: Tables.Album["id"],
  recursive: boolean = false,
): Promise<Tables.StoredMediaDetail[]> {
  // This assumes that if you can read the album you can read its descendants.
  await this.checkRead(Table.Album, [id]);

  let albums: Knex.QueryBuilder | readonly string[];
  if (recursive) {
    albums = withChildren(
      this.knex,
      Table.Album,
      from(this.knex, Table.Album)
        .where(ref(Table.Album, "id"), id),
    ).select("id");
  } else {
    albums = [id];
  }

  return from(this.knex, Table.StoredMediaDetail)
    .join(Table.MediaAlbum, ref(Table.MediaAlbum, "media"), ref(Table.StoredMediaDetail, "id"))
    // @ts-ignore: The union type spans two different overloads of the method.
    .whereIn(ref(Table.MediaAlbum, "album"), albums)
    .orderBy(ref(Table.StoredMediaDetail, "id"))
    .distinctOn(ref(Table.StoredMediaDetail, "id"))
    .select(ref(Table.StoredMediaDetail));
});

export async function listPeople(this: UserScopedConnection): Promise<Tables.Person[]> {
  let results = await from(this.knex, Table.Person)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Person, "catalog"))
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select<Tables.Person[]>(ref(Table.Person));
  return results.map(intoAPITypes);
}

export async function listTags(this: UserScopedConnection): Promise<Tables.Tag[]> {
  let results = await from(this.knex, Table.Tag)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Tag, "catalog"))
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select<Tables.Tag[]>(ref(Table.Tag));
  return results.map(intoAPITypes);
}

export const createTag = ensureUserTransaction(async function createTag(
  this: UserScopedConnection,
  catalog: Tables.Tag["catalog"],
  data: Omit<Tables.Tag, "id" | "catalog">,
): Promise<Tables.Tag> {
  await this.checkWrite(Table.Catalog, [catalog]);

  let query = insert(this.knex, Table.Tag, {
    ...intoDBTypes(data),
    id: await uuid("T"),
    catalog,
  });

  let results = await this.connection.raw(`
    :query
    ON CONFLICT :constraint DO
      UPDATE SET :name: = :newName
    RETURNING :result
  `, {
    query,
    constraint: nameConstraint(this.knex, Table.Catalog),
    name: "name",
    newName: data.name,
    result: this.connection.ref(ref(Table.Tag)),
  });
  let rows = (results.rows ?? []) as Tables.Tag[];

  if (!rows.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Tag record.");
  }

  return intoAPITypes(rows[0]);
});

export async function buildTags(
  this: UserScopedConnection,
  catalog: string,
  names: string[],
): Promise<Tables.Tag[]> {
  if (!names.length) {
    return [];
  }

  return this.ensureTransaction(
    async function buildTags(userDb: UserScopedConnection): Promise<Tables.Tag[]> {
      let parent: string | null = null;

      let tags: Tables.Tag[] = [];

      for (let name of names) {
        let newTag = await userDb.createTag(catalog, {
          parent,
          name,
        });

        parent = newTag.id;
        tags.push(newTag);
      }

      return tags;
    },
  );
}

export const editTag = ensureUserTransaction(async function editTag(
  this: UserScopedConnection,
  id: Tables.Tag["id"],
  data: Partial<Tables.Tag>,
): Promise<Tables.Tag> {
  await this.checkWrite(Table.Tag, [id]);

  let {
    id: removedId,
    catalog: removedCatalog,
    ...tagUpdateData
  } = data;
  let results = await update(
    Table.Tag,
    this.knex.where("id", id),
    intoDBTypes(tagUpdateData),
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Tag record.");
  }

  return intoAPITypes(results[0]);
});

export const deleteTags = ensureUserTransaction(async function deleteTags(
  this: UserScopedConnection,
  ids: Tables.Tag["id"][],
): Promise<void> {
  await this.checkWrite(Table.Tag, ids);

  await drop(this.knex, Table.Tag)
    .whereIn(ref(Table.Tag, "id"), ids);
});

export const createPerson = ensureUserTransaction(async function createPerson(
  this: UserScopedConnection,
  catalog: Tables.Person["catalog"],
  data: Omit<Tables.Person, "id" | "catalog">,
): Promise<Tables.Person> {
  await this.checkWrite(Table.Catalog, [catalog]);

  let query = insert(this.knex, Table.Person, {
    ...intoDBTypes(data),
    id: await uuid("P"),
    catalog,
  });

  let results = await this.connection.raw(`
    :query
    ON CONFLICT :constraint DO
      UPDATE SET :name: = :newName
    RETURNING :result
  `, {
    query,
    constraint: nameConstraint(this.knex, Table.Catalog, null),
    name: "name",
    newName: data.name,
    result: this.connection.ref(ref(Table.Person)),
  });
  let rows = (results.rows ?? []) as Tables.Person[];

  if (!rows.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Person record.");
  }

  return intoAPITypes(rows[0]);
});

export const editPerson = ensureUserTransaction(async function editPerson(
  this: UserScopedConnection,
  id: Tables.Person["id"],
  data: Partial<Tables.Person>,
): Promise<Tables.Person> {
  await this.checkWrite(Table.Person, [id]);

  let {
    id: removedId,
    catalog: removedCatalog,
    ...personUpdateData
  } = data;
  let results = await update(
    Table.Person,
    this.knex.where("id", id),
    intoDBTypes(personUpdateData),
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Person record.");
  }

  return intoAPITypes(results[0]);
});

export const deletePeople = ensureUserTransaction(async function deletePeople(
  this: UserScopedConnection,
  ids: Tables.Person["id"][],
): Promise<void> {
  await this.checkWrite(Table.Person, ids);

  await drop(this.knex, Table.Person)
    .whereIn(ref(Table.Person, "id"), ids);
});
