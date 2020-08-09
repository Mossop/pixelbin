import path from "path";

import Knex from "knex";
import moment, { Moment } from "moment-timezone";
import { types } from "pg";

import { getLogger, Obj } from "../../utils";
import * as CatalogQueries from "./catalog";
import * as Functions from "./functions";
import * as Joins from "./joins";
import * as MediaQueries from "./media";
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

interface ExtendedKnex extends Knex {
  userParams: {
    schema?: string;
  }
  withUserParams(params: Record<string, unknown>): ExtendedKnex;
}

function parseTimestamp(value: string): Moment {
  return moment(value).utc();
}
types.setTypeParser(types.builtins.TIMESTAMPTZ, parseTimestamp);
types.setTypeParser(types.builtins.TIMESTAMP, parseTimestamp);

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
    return (...args: unknown[]) => this._knex.ref(...args);
  }

  public get raw(): Knex.RawBuilder {
    /* @ts-ignore: We're just simulating a direct call here. */
    return (...args: unknown[]) => this._knex.raw(...args);
  }

  public destroy(): Promise<void> {
    if (this._transaction) {
      throw new Error("Cannot destroy a transaction.");
    }

    return this.knex.destroy();
  }

  public readonly coalesce = Functions.coalesce;

  public readonly getMedia = Unsafe.getMedia;
  public readonly withNewOriginal = Unsafe.withNewOriginal;
  public readonly addAlternateFile = Unsafe.addAlternateFile;
  public readonly getStorageConfig = Unsafe.getStorageConfig;

  public readonly getUser = UserQueries.getUser;

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
  protected get knex(): Knex {
    return this.connection.knex;
  }

  public constructor(protected connection: DatabaseConnection, public readonly user: UserRef) {
  }

  protected inTransaction<T>(
    transactionFn: (connection: UserScopedConnection) => Promise<T>,
  ): Promise<T> {
    return this.connection.inTransaction((dbConnection: DatabaseConnection): Promise<T> => {
      return transactionFn(dbConnection.forUser(this.user));
    });
  }

  public readonly listStorage = CatalogQueries.listStorage;
  public readonly createStorage = CatalogQueries.createStorage;
  public readonly listCatalogs = CatalogQueries.listCatalogs;
  public readonly createCatalog = CatalogQueries.createCatalog;
  public readonly listAlbums = CatalogQueries.listAlbums;
  public readonly createAlbum = CatalogQueries.createAlbum;
  public readonly editAlbum = CatalogQueries.editAlbum;
  public readonly listPeople = CatalogQueries.listPeople;
  public readonly listTags = CatalogQueries.listTags;
  public readonly createTag = CatalogQueries.createTag;
  public readonly editTag = CatalogQueries.editTag;
  public readonly createPerson = CatalogQueries.createPerson;
  public readonly editPerson = CatalogQueries.editPerson;

  public readonly addMedia = Joins.addMedia;
  public readonly removeMedia = Joins.removeMedia;
  public readonly setMedia = Joins.setMedia;

  public readonly createMedia = MediaQueries.createMedia;
  public readonly editMedia = MediaQueries.editMedia;
  public readonly getMedia = MediaQueries.getMedia;
  public readonly listAlternateFiles = MediaQueries.listAlternateFiles;
}
