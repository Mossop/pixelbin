import moment from "moment-timezone";

import { from, insert, drop, into } from "./queries";
import { connection, buildTestDB } from "./test-helpers";
import { Table } from "./types";

buildTestDB();

test("Basic database connection", async (): Promise<void> => {
  let dbConnection = await connection;

  await insert(dbConnection.knex, Table.User, {
    email: "someone1@nowhere.com",
    password: "foo",
    fullname: "Dave",
    lastLogin: null,
    verified: true,
    created: moment(),
  });

  await insert(dbConnection.knex, Table.Storage, {
    id: "s1",
    owner: "someone1@nowhere.com",
    name: "Test storage",
    accessKeyId: "bar",
    secretAccessKey: "foo",
    region: "nowhere",
    endpoint: "anywhere",
    bucket: "buckit",
    path: null,
    publicUrl: null,
  });

  await insert(dbConnection.knex, Table.Catalog, {
    id: "foo",
    storage: "s1",
    name: "bar",
  });

  let results = await from(dbConnection.knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "foo",
    storage: "s1",
    name: "bar",
  });

  await into(dbConnection.knex, Table.Catalog).where({ id: "foo" }).update({ name: "baz" });

  results = await from(dbConnection.knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "foo",
    storage: "s1",
    name: "baz",
  });

  await drop(dbConnection.knex, Table.Catalog, { id: "foo" });

  results = await from(dbConnection.knex, Table.Catalog).select("*");
  expect(results).toHaveLength(0);
});
