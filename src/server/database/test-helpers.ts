import moment from "moment-timezone";

import { defer } from "../../utils";
import { DatabaseConfig, DatabaseConnection } from "./connection";
import { insert } from "./queries";
import { Table, TableRecord } from "./types";

const deferredConnection = defer<DatabaseConnection>();
export const connection = deferredConnection.promise;

export function getTestDatabaseConfig(): DatabaseConfig {
  return {
    username: process.env.PX_DB_USERNAME ?? "pixelbin",
    password: process.env.PX_DB_PASSWORD ?? "pixelbin",
    host: process.env.PX_DB_HOST ?? "localhost",
    database: process.env.PX_DB_NAME ?? "pixelbin_test",
  };
}

export function buildTestDB(): void {
  beforeAll((): Promise<void> => {
    return initDB();
  });

  beforeEach((): Promise<void> => {
    return resetDB();
  });

  afterAll((): Promise<void> => {
    return destroyDB();
  });
}

export async function initDB(): Promise<void> {
  let dbConnection = await DatabaseConnection.connect(getTestDatabaseConfig());
  deferredConnection.resolve(dbConnection);

  let params = dbConnection.knex["userParams"];

  if (params.schema) {
    await dbConnection.raw("DROP SCHEMA IF EXISTS ?? CASCADE;", [params.schema]);
    await dbConnection.raw("CREATE SCHEMA ??;", [params.schema]);
  }

  await dbConnection.knex.migrate.latest();
}

let first = true;
export async function resetDB(): Promise<void> {
  if (first) {
    first = false;
    return;
  }

  let dbConnection = await connection;

  let tables = [
    Table.MediaPerson,
    Table.MediaTag,
    Table.MediaAlbum,
    Table.UserCatalog,
    Table.AlternateFile,
    Table.Original,
    Table.Media,
    Table.Person,
    Table.Tag,
    Table.Album,
    Table.Catalog,
    Table.Storage,
    Table.User,
  ];

  await dbConnection.raw(
    `TRUNCATE ${tables.map((_: string): string => "??").join(", ")} CASCADE;`,
    tables,
  );
}

export async function destroyDB(): Promise<void> {
  let dbConnection = await connection;

  let params = dbConnection.knex["userParams"];

  if (params.schema) {
    await dbConnection.raw("DROP SCHEMA IF EXISTS ?? CASCADE;", [params.schema]);
  }
  await dbConnection.destroy();
}

export type Seed = {
  [K in Table]?: TableRecord<K>[];
};

export async function insertData(data: Seed): Promise<void> {
  let dbConnection = await connection;

  async function doInsert<T extends Table>(table: T): Promise<void> {
    if (!(table in data)) {
      return;
    }

    let records = data[table] as unknown as TableRecord<T>[];

    await insert(dbConnection.knex, table, records);
  }

  await doInsert(Table.User);
  await doInsert(Table.Storage);
  await doInsert(Table.Catalog);
  await doInsert(Table.Album);
  await doInsert(Table.Tag);
  await doInsert(Table.Person);
  await doInsert(Table.Media);
  await doInsert(Table.Original);
  await doInsert(Table.UserCatalog);
  await doInsert(Table.MediaAlbum);
  await doInsert(Table.MediaTag);
  await doInsert(Table.MediaPerson);
}

export const testData = {
  [Table.User]: [{
    email: "someone1@nowhere.com",
    password: "password1",
    fullname: "Someone 1",
    created: moment("2020-01-01T00:00:00Z"),
    lastLogin: null,
    verified: true,
  }, {
    email: "someone2@nowhere.com",
    password: "password2",
    fullname: "Someone 2",
    created: moment("2010-01-01T00:00:00Z"),
    lastLogin: moment("2020-02-02T00:00:00Z"),
    verified: true,
  }, {
    email: "someone3@nowhere.com",
    password: "password3",
    fullname: "Someone 3",
    created: moment("2015-01-01T00:00:00Z"),
    lastLogin: moment("2020-03-03T00:00:00Z"),
    verified: true,
  }],

  [Table.Storage]: [{
    id: "s1",
    name: "Test storage",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-west-001",
    bucket: "pixelbin",
    path: "inner/path",
    endpoint: "http://localhost:9000",
    publicUrl: null,
  }, {
    id: "s2",
    name: "Storage 2",
    accessKeyId: "otheraccessKey",
    secretAccessKey: "othersecret",
    region: "us-elsewhere-001",
    bucket: "buckit",
    path: "path",
    endpoint: null,
    publicUrl: "https://www.public.com/",
  }],

  [Table.Catalog]: [{
    id: "c1",
    storage: "s1",
    name: "Catalog 1",
  }, {
    id: "c2",
    storage: "s1",
    name: "Catalog 2",
  }, {
    id: "c3",
    storage: "s2",
    name: "Catalog 3",
  }],

  [Table.Album]: [{
    id: "a1",
    catalog: "c1",
    parent: null,
    name: "Album 1",
  }, {
    id: "a2",
    catalog: "c1",
    parent: null,
    name: "Album 2",
  }, {
    id: "a3",
    catalog: "c1",
    parent: "a1",
    name: "Album 3",
  }, {
    id: "a4",
    catalog: "c1",
    parent: "a1",
    name: "Album 4",
  }, {
    id: "a5",
    catalog: "c1",
    parent: "a3",
    name: "Album 5",
  }, {
    id: "a6",
    catalog: "c2",
    parent: null,
    name: "Album 6",
  }, {
    id: "a7",
    catalog: "c2",
    parent: "a6",
    name: "Album 7",
  }, {
    id: "a8",
    catalog: "c3",
    parent: null,
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
