import path from "path";

import Knex from "knex";
import { defer, Deferred, getLogger, Obj } from "pixelbin-utils";

const logger = getLogger({
  name: "database",
  level: "trace",
});

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
  withUserParams(params: Record<string, unknown>): ExtendedKnex;
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
    log: {
      warn(message: string): void {
        logger.warn(message);
      },

      error(message: string): void {
        logger.error(message);
      },

      debug(message: string): void {
        logger.debug(message);
      },

      deprecate(message: string): void {
        logger.debug(message);
      },
    },
  };

  if (schema) {
    knexConfig["userParams"] = {
      schema,
    };
  }

  let knex = Knex(knexConfig) as ExtendedKnex;

  knex.on("query", (data: Obj): void => {
    logger.trace({
      sql: data["sql"],
      bindings: data["bindings"],
    }, "Database query");
  });

  knex.on("query-error", (error: Obj, data: Obj): void => {
    logger.debug({
      sql: data["sql"],
      bindings: data["bindings"],
      error,
    }, error["detail"]);
  });

  knex.on("query-response", (response: Obj, data: Obj): void => {
    logger.trace({
      sql: data["sql"],
      bindings: data["bindings"],
      response,
    }, "Database query response");
  });

  deferredKnex.resolve(knex);
  return knex;
}

export const connection = deferredKnex.promise;

export function logged(knex: ExtendedKnex): ExtendedKnex {
  let cloned = knex.withUserParams({});

  cloned.on("query", (data: Obj): void => {
    logger.info({
      sql: data["sql"],
      bindings: data["bindings"],
    }, "Database query");
  });

  cloned.on("query-error", (error: Obj, data: Obj): void => {
    logger.info({
      sql: data["sql"],
      bindings: data["bindings"],
      error,
    }, error["detail"]);
  });

  cloned.on("query-response", (response: Obj, data: Obj): void => {
    logger.info({
      sql: data["sql"],
      bindings: data["bindings"],
      response: Object.fromEntries(Object.entries(response).filter(
        ([key, _value]: [string, unknown]): boolean => !key.startsWith("_"),
      )),
    }, "Database query response");
  });

  return cloned;
}
