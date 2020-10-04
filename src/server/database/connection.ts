import path from "path";

import Knex from "knex";
import moment, { Moment } from "moment-timezone";
import { types } from "pg";

import { getLogger, Obj } from "../../utils";
import * as CatalogQueries from "./catalog";
import { DatabaseError, DatabaseErrorCode } from "./error";
import * as Joins from "./joins";
import * as MediaQueries from "./media";
import * as SearchQueries from "./search";
import { UserRef } from "./types";
import * as Unsafe from "./unsafe";
import * as UserQueries from "./user";

const logger = getLogger("database");

export interface DatabaseConfig {
  username: string;
  password: string;
  host: string;
  port?: number;
  database: string;
}

function parseTimestamp(value: string): Moment {
  return moment(value).utc();
}
types.setTypeParser(types.builtins.TIMESTAMPTZ, parseTimestamp);
types.setTypeParser(types.builtins.TIMESTAMP, parseTimestamp);

function wrapped<T, A extends unknown[], R>(
  fn: (this: T, ...args: A) => Promise<R>,
): (this: T, ...args: A) => Promise<R> {
  return async function(...args: A): Promise<R> {
    try {
      return await fn.apply(this, args);
    } catch (e) {
      if (e instanceof DatabaseError) {
        throw e;
      }

      if (e.table && e.constraint && e.constraint.startsWith("foreign_")) {
        throw new DatabaseError(
          DatabaseErrorCode.MissingRelationship,
          `Unknown ${e.constraint.substring(8)} when creating ${e.table}.`,
        );
      }

      throw new DatabaseError(DatabaseErrorCode.UnknownError, String(e));
    }
  };
}

export class DatabaseConnection {
  private constructor(
    private readonly _knex: Knex,
    private readonly _transaction?: Knex.Transaction,
  ) {
  }

  public forUser(user: UserRef): UserScopedConnection {
    return new UserScopedConnection(this, user);
  }

  public inTransaction<T>(
    transactionFn: (dbConnection: DatabaseConnection) => Promise<T>,
  ): Promise<T> {
    if (this._transaction) {
      return this._transaction.savepoint((trx: Knex.Transaction) => {
        return transactionFn(new DatabaseConnection(this._knex, trx));
      });
    } else {
      return this._knex.transaction((trx: Knex.Transaction) => {
        return transactionFn(new DatabaseConnection(this._knex, trx));
      });
    }
  }

  public get knex(): Knex {
    return this._transaction ?? this._knex;
  }

  public get ref(): Knex.RefBuilder {
    /* @ts-ignore: We're just simulating a direct call here. */
    return (...args: unknown[]) => this.knex.ref(...args);
  }

  public get raw(): Knex.RawBuilder {
    /* @ts-ignore: We're just simulating a direct call here. */
    return (...args: unknown[]) => this.knex.raw(...args);
  }

  public destroy(): Promise<void> {
    if (this._transaction) {
      throw new Error("Cannot destroy a transaction.");
    }

    return this.knex.destroy();
  }

  public readonly getMedia = wrapped(Unsafe.getMedia);
  public readonly withNewOriginal = wrapped(Unsafe.withNewOriginal);
  public readonly addAlternateFile = wrapped(Unsafe.addAlternateFile);
  public readonly getStorageConfig = wrapped(Unsafe.getStorageConfig);

  public readonly loginUser = wrapped(UserQueries.loginUser);
  public readonly createUser = wrapped(UserQueries.createUser);
  public readonly listUsers = wrapped(UserQueries.listUsers);

  public static async connect(config: DatabaseConfig): Promise<DatabaseConnection> {
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

    let knex = Knex(knexConfig);

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

    return new DatabaseConnection(knex);
  }
}

export class UserScopedConnection {
  public get knex(): Knex {
    return this.connection.knex;
  }

  public constructor(protected connection: DatabaseConnection, public readonly user: UserRef) {
  }

  public get ref(): Knex.RefBuilder {
    /* @ts-ignore: We're just simulating a direct call here. */
    return (...args: unknown[]) => this.knex.ref(...args);
  }

  public get raw(): Knex.RawBuilder {
    /* @ts-ignore: We're just simulating a direct call here. */
    return (...args: unknown[]) => this.knex.raw(...args);
  }

  public inTransaction<T>(
    transactionFn: (connection: UserScopedConnection) => Promise<T>,
  ): Promise<T> {
    return this.connection.inTransaction((dbConnection: DatabaseConnection): Promise<T> => {
      return transactionFn(dbConnection.forUser(this.user));
    });
  }

  public readonly listStorage = wrapped(CatalogQueries.listStorage);
  public readonly createStorage = wrapped(CatalogQueries.createStorage);
  public readonly listCatalogs = wrapped(CatalogQueries.listCatalogs);
  public readonly createCatalog = wrapped(CatalogQueries.createCatalog);
  public readonly listMediaInCatalog = wrapped(CatalogQueries.listMediaInCatalog);
  public readonly listAlbums = wrapped(CatalogQueries.listAlbums);
  public readonly createAlbum = wrapped(CatalogQueries.createAlbum);
  public readonly editAlbum = wrapped(CatalogQueries.editAlbum);
  public readonly listMediaInAlbum = wrapped(CatalogQueries.listMediaInAlbum);
  public readonly listPeople = wrapped(CatalogQueries.listPeople);
  public readonly listTags = wrapped(CatalogQueries.listTags);
  public readonly createTag = wrapped(CatalogQueries.createTag);
  public readonly editTag = wrapped(CatalogQueries.editTag);
  public readonly buildTags = wrapped(CatalogQueries.buildTags);
  public readonly createPerson = wrapped(CatalogQueries.createPerson);
  public readonly editPerson = wrapped(CatalogQueries.editPerson);

  public readonly addMediaRelations = wrapped(Joins.addMediaRelations);
  public readonly removeMediaRelations = wrapped(Joins.removeMediaRelations);
  public readonly setMediaRelations = wrapped(Joins.setMediaRelations);
  public readonly setRelationMedia = wrapped(Joins.setRelationMedia);
  public readonly setPersonLocations = wrapped(Joins.setPersonLocations);

  public readonly createMedia = wrapped(MediaQueries.createMedia);
  public readonly editMedia = wrapped(MediaQueries.editMedia);
  public readonly getMedia = wrapped(MediaQueries.getMedia);
  public readonly listAlternateFiles = wrapped(MediaQueries.listAlternateFiles);
  public readonly deleteMedia = wrapped(MediaQueries.deleteMedia);
  public readonly searchMedia = wrapped(SearchQueries.searchMedia);
}
