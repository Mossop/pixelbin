import { connection } from "./connection";
import { from, insert, drop, into } from "./queries";
import { buildTestDB } from "./test-helpers";
import { Table } from "./types";

buildTestDB();

test("Basic database connection", async (): Promise<void> => {
  let knex = await connection;

  await insert(knex, Table.Storage, {
    id: "s1",
    name: "Test storage",
    accessKeyId: "bar",
    secretAccessKey: "foo",
    region: "nowhere",
    endpoint: "anywhere",
    publicUrl: null,
  });

  await insert(knex, Table.Catalog, {
    id: "foo",
    storage: "s1",
    name: "bar",
  });

  let results = await from(knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "foo",
    storage: "s1",
    name: "bar",
  });

  await into(knex, Table.Catalog).where({ id: "foo" }).update({ name: "baz" });

  results = await from(knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "foo",
    storage: "s1",
    name: "baz",
  });

  await drop(knex, Table.Catalog, { id: "foo" });

  results = await from(knex, Table.Catalog).select("*");
  expect(results).toHaveLength(0);
});
