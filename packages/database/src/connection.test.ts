import { knex } from "./connection";
import { CatalogData } from "./tables";

beforeAll(async (): Promise<void> => {
  if (knex.userParams.schema) {
    await knex.raw("DROP SCHEMA IF EXISTS ?? CASCADE;", [knex.userParams.schema]);
    await knex.raw("CREATE SCHEMA ??;", [knex.userParams.schema]);
  }

  await knex.migrate.latest();
});

beforeEach(async (): Promise<void> => {
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
  if (knex.userParams.schema) {
    await knex.raw("DROP SCHEMA IF EXISTS ?? CASCADE;", [knex.userParams.schema]);
  }
  await knex.destroy();
});

test("Basic database connection", async (): Promise<void> => {
  let results = await knex<CatalogData>("catalog").select("*");
  expect(results).toHaveLength(0);
});
