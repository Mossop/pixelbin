import { DatabaseConfig, connection } from "./connection";

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
