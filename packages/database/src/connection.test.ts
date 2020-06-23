import { connection } from "./connection";
import { from, insert, drop, into } from "./queries";
import { buildTestDB } from "./test-helpers";
import { Table } from "./types";

buildTestDB({
  beforeAll,
  beforeEach,
  afterAll,
});

test("Basic database connection", async (): Promise<void> => {
  let knex = await connection;

  await insert(knex, Table.Catalog, {
    id: "foo",
    name: "bar",
  });

  let results = await from(knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "foo",
    name: "bar",
  });

  await into(knex, Table.Catalog).where({ id: "foo" }).update({ name: "baz" });

  results = await from(knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "foo",
    name: "baz",
  });

  await drop(knex, Table.Catalog, { id: "foo" });

  results = await from(knex, Table.Catalog).select("*");
  expect(results).toHaveLength(0);
});
