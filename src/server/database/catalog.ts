import Knex from "knex";
import { customAlphabet } from "nanoid/async";

import { connection } from "./connection";
import { from, insert, insertFromSelect, update } from "./queries";
import { Table, Tables, ref } from "./types";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 10);
async function uuid(start: string): Promise<string> {
  return start + ":" + await nanoid();
}

export async function listStorage(user: string): Promise<Tables.Storage[]> {
  let knex = await connection;
  return from(knex, Table.Storage)
    .innerJoin(Table.Catalog, ref(Table.Catalog, "storage"), ref(Table.Storage, "id"))
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Catalog, "id"))
    .where(ref(Table.UserCatalog, "user"), user)
    .select(ref(Table.Storage)).distinct();
}

export async function createStorage(data: Omit<Tables.Storage, "id">): Promise<Tables.Storage> {
  let knex = await connection;
  let results = await insert(knex, Table.Storage, {
    ...data,
    id: await uuid("S"),
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or catalog passed to createStorage");
}

export async function listCatalogs(user: string): Promise<Tables.Catalog[]> {
  let knex = await connection;
  return from(knex, Table.Catalog)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Catalog, "id"))
    .where(ref(Table.UserCatalog, "user"), user)
    .select(ref(Table.Catalog));
}

export async function createCatalog(
  user: string,
  data: Omit<Tables.Catalog, "id">,
): Promise<Tables.Catalog> {
  let knex = await connection;
  return knex.transaction(async (trx: Knex): Promise<Tables.Catalog> => {
    let catalog: Tables.Catalog = {
      ...data,
      id: await uuid("C"),
    };

    await insert(trx, Table.Catalog, catalog);
    await insert(trx, Table.UserCatalog, {
      user,
      catalog: catalog.id,
    });

    return catalog;
  });
}

export async function listAlbums(user: string): Promise<Tables.Album[]> {
  let knex = await connection;
  return from(knex, Table.Album)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Album, "catalog"))
    .where(ref(Table.UserCatalog, "user"), user)
    .select(ref(Table.Album));
}

export async function createAlbum(
  user: string,
  catalog: string,
  data: Omit<Tables.Album, "id" | "catalog">,
): Promise<Tables.Album> {
  let knex = await connection;

  let select = knex.from(Table.UserCatalog).where({
    user,
    catalog,
  });

  let results = await insertFromSelect(knex, Table.Album, select, {
    ...data,
    id: await uuid("A"),
    catalog: knex.ref(ref(Table.UserCatalog, "catalog")),
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or catalog passed to createAlbum");
}

export async function editAlbum(
  user: string,
  id: string,
  data: Partial<Tables.Album>,
): Promise<Tables.Album> {
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
    albumUpdateData,
  ).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or album passed to editAlbum");
}

export async function listPeople(user: string): Promise<Tables.Person[]> {
  let knex = await connection;
  return from(knex, Table.Person)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Person, "catalog"))
    .where(ref(Table.UserCatalog, "user"), user)
    .select(ref(Table.Person));
}

export async function listTags(user: string): Promise<Tables.Tag[]> {
  let knex = await connection;
  return from(knex, Table.Tag)
    .innerJoin(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Tag, "catalog"))
    .where(ref(Table.UserCatalog, "user"), user)
    .select(ref(Table.Tag));
}

export async function createTag(
  user: string,
  catalog: string,
  data: Omit<Tables.Tag, "id" | "catalog">,
): Promise<Tables.Tag> {
  let knex = await connection;

  let select = knex.from(Table.UserCatalog).where({
    user,
    catalog,
  });

  let results = await insertFromSelect(knex, Table.Tag, select, {
    ...data,
    id: await uuid("T"),
    catalog: knex.ref(ref(Table.UserCatalog, "catalog")),
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or catalog passed to createTag");
}

export async function editTag(
  user: string,
  id: string,
  data: Partial<Tables.Tag>,
): Promise<Tables.Tag> {
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
    tagUpdateData,
  ).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or album passed to editTag");
}

export async function createPerson(
  user: string,
  catalog: string,
  data: Omit<Tables.Person, "id" | "catalog">,
): Promise<Tables.Person> {
  let knex = await connection;

  let select = knex.from(Table.UserCatalog).where({
    user,
    catalog,
  });

  let results = await insertFromSelect(knex, Table.Person, select, {
    ...data,
    id: await uuid("P"),
    catalog: knex.ref(ref(Table.UserCatalog, "catalog")),
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or catalog passed to createPerson");
}

export async function editPerson(
  user: string,
  id: string,
  data: Partial<Tables.Person>,
): Promise<Tables.Person> {
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
    personUpdateData,
  ).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or album passed to editPerson");
}
