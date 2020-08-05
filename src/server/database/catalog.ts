import Knex from "knex";

import { UserScopedConnection } from "./connection";
import { uuid } from "./id";
import { from, insert, insertFromSelect, update, select } from "./queries";
import {
  Table,
  Tables,
  ref,
  nameConstraint,
  DBAPI,
  intoAPITypes,
  DBRecord,
  intoDBTypes,
} from "./types";

export async function listStorage(this: UserScopedConnection): Promise<DBAPI<Tables.Storage>[]> {
  return from(this.knex, Table.Storage)
    .innerJoin(Table.Catalog, ref(Table.Catalog, "storage"), ref(Table.Storage, "id"))
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Catalog, "id"))
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select(ref(Table.Storage)).distinct();
}

export async function createStorage(
  this: UserScopedConnection,
  data: Omit<DBAPI<Tables.Storage>, "id">,
): Promise<DBAPI<Tables.Storage>> {
  let results = await insert(this.knex, Table.Storage, {
    ...data,
    id: await uuid("S"),
  }).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or catalog passed to createStorage");
}

export async function listCatalogs(this: UserScopedConnection): Promise<DBAPI<Tables.Catalog>[]> {
  let results = await select(from(this.knex, Table.Catalog)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Catalog, "id"))
    .where(ref(Table.UserCatalog, "user"), this.user), Table.Catalog);
  return results.map(intoAPITypes);
}

export async function createCatalog(
  this: UserScopedConnection,
  data: DBAPI<Omit<Tables.Catalog, "id">>,
): Promise<DBAPI<Tables.Catalog>> {
  return this.knex.transaction(async (trx: Knex): Promise<DBAPI<Tables.Catalog>> => {
    let catalog: DBRecord<Tables.Catalog> = {
      ...intoDBTypes(data),
      id: await uuid("C"),
    };

    await insert(trx, Table.Catalog, catalog);
    await insert(trx, Table.UserCatalog, {
      user: this.user,
      catalog: catalog.id,
    });

    return {
      ...data,
      id: catalog.id,
    };
  });
}

export async function listAlbums(this: UserScopedConnection): Promise<DBAPI<Tables.Album>[]> {
  let results = await select(from(this.knex, Table.Album)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Album, "catalog"))
    .where(ref(Table.UserCatalog, "user"), this.user), Table.Album);
  return results.map(intoAPITypes);
}

export async function createAlbum(
  this: UserScopedConnection,
  catalog: DBAPI<Tables.Album>["catalog"],
  data: DBAPI<Omit<Tables.Album, "id" | "catalog">>,
): Promise<DBAPI<Tables.Album>> {
  let select = this.knex.from(Table.UserCatalog).where({
    user: this.user,
    catalog,
  });

  let results = await insertFromSelect(this.knex, Table.Album, select, {
    ...intoDBTypes(data),
    id: await uuid("A"),
    catalog: this.connection.ref(ref(Table.UserCatalog, "catalog")),
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or catalog passed to createAlbum");
}

export async function editAlbum(
  this: UserScopedConnection,
  id: DBAPI<Tables.Album>["id"],
  data: Partial<DBAPI<Tables.Album>>,
): Promise<DBAPI<Tables.Album>> {
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

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or album passed to editAlbum");
}

export async function albumAddMedia(
  this: UserScopedConnection,
  album: DBAPI<Tables.Album>["id"],
  media: DBAPI<Tables.Media>["id"][],
): Promise<string[]> {
  let existing = from(this.knex, Table.MediaAlbum)
    .where(ref(Table.MediaAlbum, "album"), album)
    .select("media");

  let select = from(this.knex, Table.UserCatalog)
    .join(Table.Album, ref(Table.UserCatalog, "catalog"), ref(Table.Album, "catalog"))
    .join(Table.Media, ref(Table.UserCatalog, "catalog"), ref(Table.Media, "catalog"))
    .whereIn(ref(Table.Media, "id"), media)
    .whereNotIn(ref(Table.Media, "id"), existing)
    .where({
      [ref(Table.UserCatalog, "user")]: this.user,
      [ref(Table.Album, "id")]: album,
    });

  return insertFromSelect(this.knex, Table.MediaAlbum, select, {
    catalog: this.connection.ref(ref(Table.UserCatalog, "catalog")),
    media: this.connection.ref(ref(Table.Media, "id")),
    album,
  }).returning(ref(Table.MediaAlbum, "media"));
}

export async function albumRemoveMedia(
  this: UserScopedConnection,
  album: DBAPI<Tables.Album>["id"],
  media: DBAPI<Tables.Media>["id"][],
): Promise<void> {
  let catalogs = from(this.knex, Table.UserCatalog)
    .where(ref(Table.UserCatalog, "user"), this.user)
    .select("catalog");

  await from(this.knex, Table.MediaAlbum)
    .whereIn(ref(Table.MediaAlbum, "catalog"), catalogs)
    .whereIn(ref(Table.MediaAlbum, "media"), media)
    .where(ref(Table.MediaAlbum, "album"), album)
    .delete();
}

export async function listPeople(this: UserScopedConnection): Promise<DBAPI<Tables.Person>[]> {
  let results = await select(from(this.knex, Table.Person)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Person, "catalog"))
    .where(ref(Table.UserCatalog, "user"), this.user), Table.Person);
  return results.map(intoAPITypes);
}

export async function listTags(this: UserScopedConnection): Promise<DBAPI<Tables.Tag>[]> {
  let results = await select(from(this.knex, Table.Tag)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Tag, "catalog"))
    .where(ref(Table.UserCatalog, "user"), this.user), Table.Tag);
  return results.map(intoAPITypes);
}

export async function createTag(
  this: UserScopedConnection,
  catalog: DBAPI<Tables.Tag>["catalog"],
  data: DBAPI<Omit<Tables.Tag, "id" | "catalog">>,
): Promise<DBAPI<Tables.Tag>> {
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
  let rows = results.rows ?? [];

  if (rows.length) {
    return intoAPITypes(rows[0]);
  }

  throw new Error("Invalid user or catalog passed to createTag");
}

export async function editTag(
  this: UserScopedConnection,
  id: DBAPI<Tables.Tag>["id"],
  data: DBAPI<Partial<Tables.Tag>>,
): Promise<DBAPI<Tables.Tag>> {
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

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or album passed to editTag");
}

export async function createPerson(
  this: UserScopedConnection,
  catalog: DBAPI<Tables.Person>["catalog"],
  data: DBAPI<Omit<Tables.Person, "id" | "catalog">>,
): Promise<DBAPI<Tables.Person>> {
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
  let rows = results.rows ?? [];

  if (rows.length) {
    return intoAPITypes(rows[0]);
  }

  throw new Error("Invalid user or catalog passed to createPerson");
}

export async function editPerson(
  this: UserScopedConnection,
  id: DBAPI<Tables.Person>["id"],
  data: DBAPI<Partial<Tables.Person>>,
): Promise<DBAPI<Tables.Person>> {
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

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or album passed to editPerson");
}
