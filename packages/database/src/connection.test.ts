import { connection } from "./connection";
import { from, insert, update, drop } from "./queries";
import { buildTestDB } from "./test-helpers";
import { Table } from "./types";

buildTestDB({
  beforeAll,
  beforeEach,
  afterAll,
});

test("Basic database connection", async (): Promise<void> => {
  let knex = await connection;

  await insert(Table.Catalog, {
    id: "foo",
    name: "bar",
  });

  let results = await from(knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "foo",
    name: "bar",
  });

  await update(Table.Catalog, { id: "foo" }, { name: "baz" });

  results = await from(knex, Table.Catalog).select("*");
  expect(results).toHaveLength(1);
  expect(results[0]).toEqual({
    id: "foo",
    name: "baz",
  });

  await drop(Table.Catalog, { id: "foo" });

  results = await from(knex, Table.Catalog).select("*");
  expect(results).toHaveLength(0);
});
