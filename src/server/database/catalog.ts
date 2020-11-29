import type Knex from "knex";

import type { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode, notfound } from "./error";
import { uuid } from "./id";
import { drop, from, insert, update, withChildren } from "./queries";
import type { Tables } from "./types";
import { Table, ref, nameConstraint, intoDBTypes } from "./types";
import { deleteFields, ensureUserTransaction } from "./utils";

export async function listStorage(this: UserScopedConnection): Promise<Tables.Storage[]> {
  return from(this.knex, Table.Storage)
    .where(ref(Table.Storage, "owner"), this.user)
    .select(ref(Table.Storage));
}

export async function createStorage(
  this: UserScopedConnection,
  data: Omit<Tables.Storage, "id" | "owner">,
): Promise<Tables.Storage> {
  let results = await insert(this.knex, Table.Storage, {
    ...data,
    id: await uuid("S"),
    owner: this.user,
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Storage record.");
}

export async function listCatalogs(this: UserScopedConnection): Promise<Tables.Catalog[]> {
  let results = await this.loggedQuery(from(this.knex, Table.Catalog)
    .whereIn(ref(Table.Catalog, "id"), this.catalogs())
    .select<Tables.Catalog[]>(ref(Table.Catalog)), "listCatalogs");
  return results;
}

export const createCatalog = ensureUserTransaction(async function createCatalog(
  this: UserScopedConnection,
  storage: Tables.Storage["id"],
  data: Omit<Tables.Catalog, "id" | "storage">,
): Promise<Tables.Catalog> {
  let ids = await this.knex.from(Table.Storage)
    .where({
      owner: this.user,
      id: storage,
    })
    .select("id");

  if (ids.length != 1) {
    notfound(Table.Storage);
  }

  let results = await insert(this.knex, Table.Catalog, {
    ...intoDBTypes(data),
    id: await uuid("C"),
    storage: storage,
  }).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Catalog record.");
  }

  return results[0];
});

export const editCatalog = ensureUserTransaction(async function editCatalog(
  this: UserScopedConnection,
  id: Tables.Catalog["id"],
  data: Partial<Omit<Tables.Catalog, "id" | "storage">>,
): Promise<Tables.Catalog> {
  await this.checkWrite(Table.Catalog, [id]);

  let catalogUpdateData = deleteFields(data, [
    "id",
    "storage",
  ]);

  let results = await update(
    Table.Catalog,
    this.knex.where("id", id),
    intoDBTypes(catalogUpdateData),
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Catalog record.");
  }

  return results[0];
});

export async function listAlbums(this: UserScopedConnection): Promise<Tables.Album[]> {
  return this.loggedQuery(from(this.knex, Table.Album)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Album, "catalog"))
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select<Tables.Album[]>(ref(Table.Album)), "listAlbums");
}

export async function listMediaInCatalog(
  this: UserScopedConnection,
  id: Tables.Catalog["id"],
): Promise<Tables.MediaView[]> {
  await this.checkRead(Table.Catalog, [id]);

  return this.loggedQuery(from(this.knex, Table.MediaView)
    .andWhere(ref(Table.MediaView, "catalog"), id)
    .orderByRaw(this.raw("COALESCE(??, ??) DESC", [
      ref(Table.MediaView, "taken"),
      ref(Table.MediaView, "created"),
    ]))
    .select(ref(Table.MediaView)), "listMediaInCatalog");
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
  data: Partial<Omit<Tables.Album, "id" | "catalog">>,
): Promise<Tables.Album> {
  await this.checkWrite(Table.Album, [id]);

  let albumUpdateData = deleteFields(data, [
    "id",
    "catalog",
  ]);

  let results = await update(
    Table.Album,
    this.knex.where("id", id),
    intoDBTypes(albumUpdateData),
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Album record.");
  }

  return results[0];
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
): Promise<Tables.MediaView[]> {
  // This assumes that if you can read the album you can read its descendants.
  await this.checkRead(Table.Album, [id]);

  let mediaIds: Knex.QueryBuilder;
  if (recursive) {
    let albums = withChildren(
      this.knex,
      Table.Album,
      from(this.knex, Table.Album)
        .where(ref(Table.Album, "id"), id),
    ).select("id");

    mediaIds = from(this.knex, Table.MediaAlbum)
      .whereIn(ref(Table.MediaAlbum, "album"), albums)
      .distinct(ref(Table.MediaAlbum, "media"));
  } else {
    mediaIds = from(this.knex, Table.MediaAlbum)
      .where(ref(Table.MediaAlbum, "album"), id)
      .distinct(ref(Table.MediaAlbum, "media"));
  }

  return this.loggedQuery(from(this.knex, Table.MediaView)
    .whereIn(ref(Table.MediaView, "id"), mediaIds)
    .orderByRaw(this.raw("COALESCE(??, ??) DESC", [
      ref(Table.MediaView, "taken"),
      ref(Table.MediaView, "created"),
    ]))
    .select(ref(Table.MediaView)), "listMediaInAlbum");
});

export async function listPeople(this: UserScopedConnection): Promise<Tables.Person[]> {
  return this.loggedQuery(from(this.knex, Table.Person)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Person, "catalog"))
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select<Tables.Person[]>(ref(Table.Person)), "listPeople");
}

export async function listTags(this: UserScopedConnection): Promise<Tables.Tag[]> {
  return this.loggedQuery(from(this.knex, Table.Tag)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Tag, "catalog"))
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select<Tables.Tag[]>(ref(Table.Tag)), "listTags");
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

  return rows[0];
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
  data: Partial<Omit<Tables.Tag, "id" | "catalog">>,
): Promise<Tables.Tag> {
  await this.checkWrite(Table.Tag, [id]);

  let tagUpdateData = deleteFields(data, [
    "id",
    "catalog",
  ]);

  let results = await update(
    Table.Tag,
    this.knex.where("id", id),
    intoDBTypes(tagUpdateData),
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Tag record.");
  }

  return results[0];
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

  return rows[0];
});

export const editPerson = ensureUserTransaction(async function editPerson(
  this: UserScopedConnection,
  id: Tables.Person["id"],
  data: Partial<Omit<Tables.Person, "id" | "catalog">>,
): Promise<Tables.Person> {
  await this.checkWrite(Table.Person, [id]);

  let personUpdateData = deleteFields(data, [
    "id",
    "catalog",
  ]);

  let results = await update(
    Table.Person,
    this.knex.where("id", id),
    intoDBTypes(personUpdateData),
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Person record.");
  }

  return results[0];
});

export const deletePeople = ensureUserTransaction(async function deletePeople(
  this: UserScopedConnection,
  ids: Tables.Person["id"][],
): Promise<void> {
  await this.checkWrite(Table.Person, ids);

  await drop(this.knex, Table.Person)
    .whereIn(ref(Table.Person, "id"), ids);
});
