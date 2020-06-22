import Knex from "knex";
import { customAlphabet } from "nanoid/async";

import { connection } from "./connection";
import { into, from, insert, insertFromSelect } from "./queries";
import { Table, Tables, ref } from "./types";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 10);
async function uuid(start: string): Promise<string> {
  return start + ":" + await nanoid();
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

    await insert(Table.Catalog, catalog, trx);
    await insert(Table.UserCatalog, {
      user,
      catalog: catalog.id,
    }, trx);

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
  data: Partial<Omit<Tables.Album, "id" | "catalog">>,
): Promise<Tables.Album> {
  let knex = await connection;
  let catalogs = from(knex, Table.UserCatalog).where("user", user).select("catalog");

  let results = await into(knex, Table.Album)
    .where("id", id)
    .andWhere("catalog", "in", catalogs)
    .update({
      ...data,
      id: undefined,
      catalog: undefined,
    })
    .returning("*");

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
  data: Partial<Omit<Tables.Tag, "id" | "catalog">>,
): Promise<Tables.Tag> {
  let knex = await connection;
  let catalogs = from(knex, Table.UserCatalog).where("user", user).select("catalog");

  let results = await into(knex, Table.Tag)
    .where("id", id)
    .andWhere("catalog", "in", catalogs)
    .update({
      ...data,
      id: undefined,
      catalog: undefined,
    })
    .returning("*");

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
  data: Partial<Omit<Tables.Person, "id" | "catalog">>,
): Promise<Tables.Person> {
  let knex = await connection;
  let catalogs = from(knex, Table.UserCatalog).where("user", user).select("catalog");

  let results = await into(knex, Table.Person)
    .where("id", id)
    .andWhere("catalog", "in", catalogs)
    .update({
      ...data,
      id: undefined,
      catalog: undefined,
    })
    .returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or album passed to editPerson");
}
