import { connection, connect } from "./connection";
import { from, insert, update, drop } from "./queries";
import { getTestDatabaseConfig, initDB, resetDB, destroyDB } from "./test-helpers";
import { Table } from "./types";

beforeAll(async (): Promise<void> => {
  connect(getTestDatabaseConfig());

  await initDB();
});

beforeEach(resetDB);

afterAll(destroyDB);

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
