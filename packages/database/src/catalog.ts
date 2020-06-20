import Knex from "knex";
import { customAlphabet } from "nanoid/async";

import { connection } from "./connection";
import { from, insert } from "./queries";
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

export async function createCatalog(user: string, name: string): Promise<Tables.Catalog> {
  let knex = await connection;
  return knex.transaction(async (trx: Knex): Promise<Tables.Catalog> => {
    let catalog: Tables.Catalog = {
      id: await uuid("C"),
      name,
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
