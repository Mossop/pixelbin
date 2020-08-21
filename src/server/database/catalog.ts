import Knex from "knex";

import { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { uuid } from "./id";
import { from, insert, insertFromSelect, update, withChildren } from "./queries";
import { Table, Tables, ref, nameConstraint, intoAPITypes, intoDBTypes } from "./types";

export async function listStorage(this: UserScopedConnection): Promise<Tables.Storage[]> {
  return from(this.knex, Table.Storage)
    .innerJoin(Table.Catalog, ref(Table.Catalog, "storage"), ref(Table.Storage, "id"))
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Catalog, "id"))
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select(ref(Table.Storage)).distinct();
}

export async function createStorage(
  this: UserScopedConnection,
  data: Omit<Tables.Storage, "id">,
): Promise<Tables.Storage> {
  let results = await insert(this.knex, Table.Storage, {
    ...data,
    id: await uuid("S"),
  }).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Storage record.");
}

export async function listCatalogs(this: UserScopedConnection): Promise<Tables.Catalog[]> {
  let results = await from(this.knex, Table.Catalog)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Catalog, "id"))
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select<Tables.Catalog[]>(ref(Table.Catalog));
  return results.map(intoAPITypes);
}

export async function createCatalog(
  this: UserScopedConnection,
  data: Omit<Tables.Catalog, "id">,
): Promise<Tables.Catalog> {
  return this.knex.transaction(async (trx: Knex): Promise<Tables.Catalog> => {
    let catalog: Tables.Catalog = {
      ...data,
      id: await uuid("C"),
    };

    let results = await insert(trx, Table.Catalog, catalog)
      .returning("*") as Tables.Catalog[];
    await insert(trx, Table.UserCatalog, {
      user: this.user,
      catalog: catalog.id,
    });

    if (!results.length) {
      throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Catalog record.");
    }

    return results[0];
  });
}

export async function listAlbums(this: UserScopedConnection): Promise<Tables.Album[]> {
  let results = await from(this.knex, Table.Album)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Album, "catalog"))
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select<Tables.Album[]>(ref(Table.Album));
  return results.map(intoAPITypes);
}

export async function createAlbum(
  this: UserScopedConnection,
  catalog: Tables.Album["catalog"],
  data: Omit<Tables.Album, "id" | "catalog">,
): Promise<Tables.Album> {
  let select = this.knex.from(Table.UserCatalog).where({
    user: this.user,
    catalog,
  });

  let results = await insertFromSelect(this.knex, Table.Album, select, {
    ...intoDBTypes(data),
    id: await uuid("A"),
    catalog: this.connection.ref(ref(Table.UserCatalog, "catalog")),
  }).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Album record.");
  }

  return results[0];
}

export async function editAlbum(
  this: UserScopedConnection,
  id: Tables.Album["id"],
  data: Partial<Tables.Album>,
): Promise<Tables.Album> {
  let catalogs = from(this.knex, Table.UserCatalog).where("user", this.user).select("catalog");

  let {
    id: removedId,
    catalog: removedCatalog,
    ...albumUpdateData
  } = data;
  let results = await update(
    Table.Album,
    this.knex.where("id", id)
      .where("catalog", "in", catalogs),
    intoDBTypes(albumUpdateData),
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Album record.");
  }

  return intoAPITypes(results[0]);
}

export async function listMediaInAlbum(
  this: UserScopedConnection,
  id: Tables.Album["id"],
  recursive: boolean = false,
): Promise<Tables.StoredMedia[]> {
  let albums: Knex.QueryBuilder;
  if (recursive) {
    albums = withChildren(
      this.knex,
      Table.Album,
      from(this.knex, Table.Album)
        .join(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Album, "catalog"))
        .where(ref(Table.UserCatalog, "user"), this.user)
        .where(ref(Table.Album, "id"), id),
    ).select("id");
  } else {
    albums = from(this.knex, Table.Album)
      .join(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Album, "catalog"))
      .where(ref(Table.UserCatalog, "user"), this.user)
      .where(ref(Table.Album, "id"), id)
      .select(ref(Table.Album, "id"));
  }

  return from(this.knex, Table.StoredMediaDetail)
    .join(Table.MediaAlbum, ref(Table.MediaAlbum, "media"), ref(Table.StoredMediaDetail, "id"))
    .whereIn(ref(Table.MediaAlbum, "album"), albums)
    .orderBy(ref(Table.StoredMediaDetail, "id"))
    .distinctOn(ref(Table.StoredMediaDetail, "id"))
    .select(ref(Table.StoredMediaDetail));
}

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

export async function createTag(
  this: UserScopedConnection,
  catalog: Tables.Tag["catalog"],
  data: Omit<Tables.Tag, "id" | "catalog">,
): Promise<Tables.Tag> {
  let userLookup = this.knex.from(Table.UserCatalog).where({
    user: this.user,
    catalog,
  });

  let query = insertFromSelect(this.knex, Table.Tag, userLookup, {
    ...intoDBTypes(data),
    id: await uuid("T"),
    catalog: this.connection.ref(ref(Table.UserCatalog, "catalog")),
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
}

export async function editTag(
  this: UserScopedConnection,
  id: Tables.Tag["id"],
  data: Partial<Tables.Tag>,
): Promise<Tables.Tag> {
  let catalogs = from(this.knex, Table.UserCatalog).where("user", this.user).select("catalog");

  let {
    id: removedId,
    catalog: removedCatalog,
    ...tagUpdateData
  } = data;
  let results = await update(
    Table.Tag,
    this.knex.where("id", id)
      .where("catalog", "in", catalogs),
    intoDBTypes(tagUpdateData),
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Tag record.");
  }

  return intoAPITypes(results[0]);
}

export async function createPerson(
  this: UserScopedConnection,
  catalog: Tables.Person["catalog"],
  data: Omit<Tables.Person, "id" | "catalog">,
): Promise<Tables.Person> {
  let userLookup = this.knex.from(Table.UserCatalog).where({
    user: this.user,
    catalog,
  });

  let query = insertFromSelect(this.knex, Table.Person, userLookup, {
    ...intoDBTypes(data),
    id: await uuid("P"),
    catalog: this.connection.ref(ref(Table.UserCatalog, "catalog")),
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
}

export async function editPerson(
  this: UserScopedConnection,
  id: Tables.Person["id"],
  data: Partial<Tables.Person>,
): Promise<Tables.Person> {
  let catalogs = from(this.knex, Table.UserCatalog).where("user", this.user).select("catalog");

  let {
    id: removedId,
    catalog: removedCatalog,
    ...personUpdateData
  } = data;
  let results = await update(
    Table.Person,
    this.knex.where("id", id)
      .where("catalog", "in", catalogs),
    intoDBTypes(personUpdateData),
  ).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Person record.");
  }

  return intoAPITypes(results[0]);
}
