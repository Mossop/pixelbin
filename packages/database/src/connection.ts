import path from "path";

import Knex from "knex";
import { defer, Deferred } from "pixelbin-utils";

export interface DatabaseConfig {
  username: string;
  password: string;
  host: string;
  port?: number;
  database: string;
}

interface ExtendedKnex extends Knex {
  userParams: {
    schema?: string;
  }
}

const deferredKnex: Deferred<ExtendedKnex> = defer();

export function connect(config: DatabaseConfig): ExtendedKnex {
  let schema = process.env.NODE_ENV == "test" ? `test${process.pid}` : undefined;
  let auth = `${config.username}:${config.password}`;
  let host = `${config.host}:${config.port ?? 5432}`;

  let knexConfig: Knex.Config = {
    client: "pg",
    asyncStackTraces: ["test", "development"].includes(process.env.NODE_ENV ?? ""),
    connection: `postgres://${auth}@${host}/${config.database}`,
    searchPath: schema ? [schema] : undefined,
    migrations: {
      directory: path.join(__dirname, "migrations"),
      schemaName: schema ?? undefined,
    },
  };

  if (schema) {
    knexConfig["userParams"] = {
      schema,
    };
  }

  let knex = Knex(knexConfig) as ExtendedKnex;
  deferredKnex.resolve(knex);
  return knex;
}

export const connection = deferredKnex.promise;
