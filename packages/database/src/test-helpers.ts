import { DatabaseConfig, connection } from "./connection";
import { insert } from "./queries";
import { Table, TableRecord } from "./types";

export function getTestDatabaseConfig(): DatabaseConfig {
  return {
    username: process.env.PX_DB_USERNAME ?? "pixelbin",
    password: process.env.PX_DB_PASSWORD ?? "pixelbin",
    host: process.env.PX_DB_HOST ?? "localhost",
    database: process.env.PX_DB_NAME ?? "pixelbin_test",
  };
}

export async function initDB(): Promise<void> {
  let knex = await connection;

  if (knex.userParams.schema) {
    await knex.raw("DROP SCHEMA IF EXISTS ?? CASCADE;", [knex.userParams.schema]);
    await knex.raw("CREATE SCHEMA ??;", [knex.userParams.schema]);
  }

  await knex.migrate.latest();
}

export async function resetDB(): Promise<void> {
  let knex = await connection;

  for (let table of [
    "media_person",
    "media_tag",
    "media_album",
    "user_catalog",
    "mediaInfo",
    "media",
    "person",
    "tag",
    "album",
    "catalog",
    "user",
  ]) {
    await knex.raw("TRUNCATE ?? CASCADE;", [table]);
  }
}

export async function destroyDB(): Promise<void> {
  let knex = await connection;

  if (knex.userParams.schema) {
    await knex.raw("DROP SCHEMA IF EXISTS ?? CASCADE;", [knex.userParams.schema]);
  }
  await knex.destroy();
}

export type Seed = {
  [K in Table]?: TableRecord<K>[];
};

export async function insertData(data: Seed): Promise<void> {
  async function doInsert<T extends Table>(table: T): Promise<void> {
    if (!(table in data)) {
      return;
    }

    let records = data[table] as TableRecord<T>[];

    await insert(table, records);
  }

  await doInsert(Table.User);
  await doInsert(Table.Catalog);
  await doInsert(Table.Album);
  await doInsert(Table.Tag);
  await doInsert(Table.Person);
  await doInsert(Table.Media);
  await doInsert(Table.MediaInfo);
  await doInsert(Table.UserCatalog);
  await doInsert(Table.MediaAlbum);
  await doInsert(Table.MediaTag);
  await doInsert(Table.MediaPerson);
}

export const testData = {
  [Table.User]: [{
    email: "someone1@nowhere.com",
    fullname: "Someone 1",
    hadCatalog: false,
    verified: true,
  }, {
    email: "someone2@nowhere.com",
    fullname: "Someone 2",
    hadCatalog: false,
    verified: true,
  }, {
    email: "someone3@nowhere.com",
    fullname: "Someone 3",
    hadCatalog: false,
    verified: true,
  }],

  [Table.Catalog]: [{
    id: "c1",
    name: "Catalog 1",
  }, {
    id: "c2",
    name: "Catalog 2",
  }, {
    id: "c3",
    name: "Catalog 3",
  }],

  [Table.Album]: [{
    id: "a1",
    catalog: "c1",
    parent: null,
    stub: null,
    name: "Album 1",
  }, {
    id: "a2",
    catalog: "c1",
    parent: null,
    stub: "a2s",
    name: "Album 2",
  }, {
    id: "a3",
    catalog: "c1",
    parent: "a1",
    stub: null,
    name: "Album 3",
  }, {
    id: "a4",
    catalog: "c1",
    parent: "a1",
    stub: "a4s",
    name: "Album 4",
  }, {
    id: "a5",
    catalog: "c1",
    parent: "a3",
    stub: null,
    name: "Album 5",
  }, {
    id: "a6",
    catalog: "c2",
    parent: null,
    stub: null,
    name: "Album 6",
  }, {
    id: "a7",
    catalog: "c2",
    parent: "a6",
    stub: null,
    name: "Album 7",
  }, {
    id: "a8",
    catalog: "c3",
    parent: null,
    stub: null,
    name: "Album 8",
  }],

  [Table.Tag]: [{
    id: "t1",
    catalog: "c1",
    parent: null,
    name: "tag1",
  }, {
    id: "t2",
    catalog: "c1",
    parent: null,
    name: "tag2",
  }, {
    id: "t3",
    catalog: "c3",
    parent: null,
    name: "tag3",
  }, {
    id: "t4",
    catalog: "c3",
    parent: "t3",
    name: "tag4",
  }, {
    id: "t5",
    catalog: "c3",
    parent: null,
    name: "tag5",
  }, {
    id: "t6",
    catalog: "c1",
    parent: "t2",
    name: "tag6",
  }, {
    id: "t7",
    catalog: "c1",
    parent: "t6",
    name: "tag7",
  }, {
    id: "t8",
    catalog: "c1",
    parent: "t2",
    name: "tag8",
  }],

  [Table.Person]: [{
    id: "p1",
    catalog: "c1",
    name: "Person 1",
  }, {
    id: "p2",
    catalog: "c1",
    name: "Person 2",
  }, {
    id: "p3",
    catalog: "c2",
    name: "Person 3",
  }, {
    id: "p4",
    catalog: "c3",
    name: "Person 4",
  }, {
    id: "p5",
    catalog: "c3",
    name: "Person 5",
  }, {
    id: "p6",
    catalog: "c3",
    name: "Person 6",
  }],

  [Table.UserCatalog]: [{
    catalog: "c1",
    user: "someone1@nowhere.com",
  }, {
    catalog: "c2",
    user: "someone1@nowhere.com",
  }, {
    catalog: "c3",
    user: "someone1@nowhere.com",
  }, {
    catalog: "c1",
    user: "someone2@nowhere.com",
  }, {
    catalog: "c2",
    user: "someone3@nowhere.com",
  }, {
    catalog: "c3",
    user: "someone3@nowhere.com",
  }],
};

export function insertTestData(): Promise<void> {
  return insertData(testData);
}
