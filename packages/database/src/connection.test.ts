import config from "../knexfile";
import { connection, connect } from "./connection";
import { from, insert } from "./queries";
import { Table } from "./types";

beforeAll(async (): Promise<void> => {
  let knex = connect(config["test"]);

  if (knex.userParams.schema) {
    await knex.raw("DROP SCHEMA IF EXISTS ?? CASCADE;", [knex.userParams.schema]);
    await knex.raw("CREATE SCHEMA ??;", [knex.userParams.schema]);
  }

  await knex.migrate.latest();
});

beforeEach(async (): Promise<void> => {
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
});

afterAll(async (): Promise<void> => {
  let knex = await connection;

  if (knex.userParams.schema) {
    await knex.raw("DROP SCHEMA IF EXISTS ?? CASCADE;", [knex.userParams.schema]);
  }
  await knex.destroy();
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
});
