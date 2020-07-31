import Knex from "knex";

import { connection } from "./connection";
import { uuid } from "./id";
import { from, insert, insertFromSelect, update, select } from "./queries";
import {
  Table,
  Tables,
  ref,
  UserRef,
  nameConstraint,
  DBAPI,
  intoAPITypes,
  DBRecord,
  intoDBTypes,
} from "./types";

export async function listStorage(user: UserRef): Promise<DBAPI<Tables.Storage>[]> {
  let knex = await connection;
  return from(knex, Table.Storage)
    .innerJoin(Table.Catalog, ref(Table.Catalog, "storage"), ref(Table.Storage, "id"))
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Catalog, "id"))
    .where(ref(Table.UserCatalog, "user"), user)
    .select(ref(Table.Storage)).distinct();
}

export async function createStorage(
  data: Omit<DBAPI<Tables.Storage>, "id">,
): Promise<DBAPI<Tables.Storage>> {
  let knex = await connection;
  let results = await insert(knex, Table.Storage, {
    ...data,
    id: await uuid("S"),
  }).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or catalog passed to createStorage");
}

export async function listCatalogs(user: UserRef): Promise<DBAPI<Tables.Catalog>[]> {
  let knex = await connection;
  let results = await select(from(knex, Table.Catalog)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Catalog, "id"))
    .where(ref(Table.UserCatalog, "user"), user), Table.Catalog);
  return results.map(intoAPITypes);
}

export async function createCatalog(
  user: UserRef,
  data: DBAPI<Omit<Tables.Catalog, "id">>,
): Promise<DBAPI<Tables.Catalog>> {
  let knex = await connection;
  return knex.transaction(async (trx: Knex): Promise<DBAPI<Tables.Catalog>> => {
    let catalog: DBRecord<Tables.Catalog> = {
      ...intoDBTypes(data),
      id: await uuid("C"),
    };

    await insert(trx, Table.Catalog, catalog);
    await insert(trx, Table.UserCatalog, {
      user,
      catalog: catalog.id,
    });

    return {
      ...data,
      id: catalog.id,
    };
  });
}

export async function listAlbums(user: UserRef): Promise<DBAPI<Tables.Album>[]> {
  let knex = await connection;
  let results = await select(from(knex, Table.Album)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Album, "catalog"))
    .where(ref(Table.UserCatalog, "user"), user), Table.Album);
  return results.map(intoAPITypes);
}

export async function createAlbum(
  user: UserRef,
  catalog: DBAPI<Tables.Album>["catalog"],
  data: DBAPI<Omit<Tables.Album, "id" | "catalog">>,
): Promise<DBAPI<Tables.Album>> {
  let knex = await connection;

  let select = knex.from(Table.UserCatalog).where({
    user,
    catalog,
  });

  let results = await insertFromSelect(knex, Table.Album, select, {
    ...intoDBTypes(data),
    id: await uuid("A"),
    catalog: knex.ref(ref(Table.UserCatalog, "catalog")),
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or catalog passed to createAlbum");
}

export async function editAlbum(
  user: UserRef,
  id: DBAPI<Tables.Album>["id"],
  data: Partial<DBAPI<Tables.Album>>,
): Promise<DBAPI<Tables.Album>> {
  let knex = await connection;
  let catalogs = from(knex, Table.UserCatalog).where("user", user).select("catalog");

  let {
    id: removedId,
    catalog: removedCatalog,
    ...albumUpdateData
  } = data;
  let results = await update(
    Table.Album,
    knex.where("id", id)
      .andWhere("catalog", "in", catalogs),
    intoDBTypes(albumUpdateData),
  ).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or album passed to editAlbum");
}

export async function listPeople(user: UserRef): Promise<DBAPI<Tables.Person>[]> {
  let knex = await connection;
  let results = await select(from(knex, Table.Person)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Person, "catalog"))
    .where(ref(Table.UserCatalog, "user"), user), Table.Person);
  return results.map(intoAPITypes);
}

export async function listTags(user: UserRef): Promise<DBAPI<Tables.Tag>[]> {
  let knex = await connection;
  let results = await select(from(knex, Table.Tag)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Tag, "catalog"))
    .where(ref(Table.UserCatalog, "user"), user), Table.Tag);
  return results.map(intoAPITypes);
}

export async function createTag(
  user: UserRef,
  catalog: DBAPI<Tables.Tag>["catalog"],
  data: DBAPI<Omit<Tables.Tag, "id" | "catalog">>,
): Promise<DBAPI<Tables.Tag>> {
  let knex = await connection;

  let userLookup = knex.from(Table.UserCatalog).where({
    user,
    catalog,
  });

  let query = insertFromSelect(knex, Table.Tag, userLookup, {
    ...intoDBTypes(data),
    id: await uuid("T"),
    catalog: knex.ref(ref(Table.UserCatalog, "catalog")),
  });

  let results = await knex.raw(`
    :query
    ON CONFLICT :constraint DO
      UPDATE SET :name: = :newName
    RETURNING :result
  `, {
    query,
    constraint: nameConstraint(knex, Table.Catalog),
    name: "name",
    newName: data.name,
    result: knex.ref(ref(Table.Tag)),
  });
  let rows = results.rows ?? [];

  if (rows.length) {
    return intoAPITypes(rows[0]);
  }

  throw new Error("Invalid user or catalog passed to createTag");
}

export async function editTag(
  user: UserRef,
  id: DBAPI<Tables.Tag>["id"],
  data: DBAPI<Partial<Tables.Tag>>,
): Promise<DBAPI<Tables.Tag>> {
  let knex = await connection;
  let catalogs = from(knex, Table.UserCatalog).where("user", user).select("catalog");

  let {
    id: removedId,
    catalog: removedCatalog,
    ...tagUpdateData
  } = data;
  let results = await update(
    Table.Tag,
    knex.where("id", id)
      .andWhere("catalog", "in", catalogs),
    intoDBTypes(tagUpdateData),
  ).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or album passed to editTag");
}

export async function createPerson(
  user: UserRef,
  catalog: DBAPI<Tables.Person>["catalog"],
  data: DBAPI<Omit<Tables.Person, "id" | "catalog">>,
): Promise<DBAPI<Tables.Person>> {
  let knex = await connection;

  let userLookup = knex.from(Table.UserCatalog).where({
    user,
    catalog,
  });

  let query = insertFromSelect(knex, Table.Person, userLookup, {
    ...intoDBTypes(data),
    id: await uuid("P"),
    catalog: knex.ref(ref(Table.UserCatalog, "catalog")),
  });

  let results = await knex.raw(`
    :query
    ON CONFLICT :constraint DO
      UPDATE SET :name: = :newName
    RETURNING :result
  `, {
    query,
    constraint: nameConstraint(knex, Table.Catalog, null),
    name: "name",
    newName: data.name,
    result: knex.ref(ref(Table.Person)),
  });
  let rows = results.rows ?? [];

  if (rows.length) {
    return intoAPITypes(rows[0]);
  }

  throw new Error("Invalid user or catalog passed to createPerson");
}

export async function editPerson(
  user: UserRef,
  id: DBAPI<Tables.Person>["id"],
  data: DBAPI<Partial<Tables.Person>>,
): Promise<DBAPI<Tables.Person>> {
  let knex = await connection;
  let catalogs = from(knex, Table.UserCatalog).where("user", user).select("catalog");

  let {
    id: removedId,
    catalog: removedCatalog,
    ...personUpdateData
  } = data;
  let results = await update(
    Table.Person,
    knex.where("id", id)
      .andWhere("catalog", "in", catalogs),
    intoDBTypes(personUpdateData),
  ).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or album passed to editPerson");
}
