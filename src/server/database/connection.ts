import Knex from "knex";
import { DateTime as Luxon, FixedOffsetZone } from "luxon";
import { types } from "pg";

import type { DateTime, Logger, Obj } from "../../utils";
import { Level, getLogger } from "../../utils";
import * as CatalogQueries from "./catalog";
import { DatabaseError, DatabaseErrorCode, notfound, notwritable } from "./error";
import * as Joins from "./joins";
import * as MediaQueries from "./media";
import Migrations from "./migrations";
import { from } from "./queries";
import * as SearchQueries from "./search";
import { seed } from "./seed";
import type { TableRecord, UserRef } from "./types";
import { ref, Table } from "./types";
import * as Unsafe from "./unsafe";
import * as UserQueries from "./user";
import type { Named, TxnFn } from "./utils";
import { asTable, named } from "./utils";

const logger = getLogger("database");

export interface DatabaseConfig {
  username: string;
  password: string;
  host: string;
  port?: number;
  database: string;
}

// 2020-11-28 03:06:45.574+00
const intSub = (
  str: string,
  start: number,
  length: number,
): number => parseInt(str.substring(start, start + length));

export function parseUTCDate(val: string): DateTime {
  let millis = 0;
  if (val.length > 20) {
    millis = parseInt(val.substring(20));
  }

  let dt = Luxon.utc(
    intSub(val, 0, 4),
    intSub(val, 5, 2),
    intSub(val, 8, 2),
    intSub(val, 11, 2),
    intSub(val, 14, 2),
    intSub(val, 17, 2),
    millis,
  );

  let offsetChar = val.charAt(val.length - 3);
  let offset = 0;
  switch (offsetChar) {
    case "+":
    case "-": {
      let hourOffset = parseInt(val.substring(val.length - 2));
      if (offsetChar == "-") {
        offset = -hourOffset * 60;
      } else {
        offset = hourOffset * 60;
      }
      break;
    }
    case ":": {
      offsetChar = val.charAt(val.length - 6);
      if (offsetChar != "+" && offsetChar != "-") {
        break;
      }

      let hourOffset = parseInt(val.substring(val.length - 5));
      let minuteOffset = parseInt(val.substring(val.length - 2));
      if (val.charAt(val.length - 6) == "-") {
        offset = -hourOffset * 60 + minuteOffset;
      } else {
        offset = -hourOffset * 60 + minuteOffset;
      }
      break;
    }
  }

  if (offset != 0) {
    dt = dt.setZone(FixedOffsetZone.instance(offset), {
      keepLocalTime: true,
    }).toUTC();
  }

  return dt;
}

export function parseDate(val: string): DateTime {
  let millis = 0;
  if (val.length > 20) {
    millis = parseInt(val.substring(20));
  }

  return Luxon.local(
    intSub(val, 0, 4),
    intSub(val, 5, 2),
    intSub(val, 8, 2),
    intSub(val, 11, 2),
    intSub(val, 14, 2),
    intSub(val, 17, 2),
    millis,
  );
}

types.setTypeParser(types.builtins.TIMESTAMPTZ, parseUTCDate);
types.setTypeParser(types.builtins.TIMESTAMP, parseDate);
types.setTypeParser(types.builtins.INT8, BigInt);

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
          e,
        );
      }

      throw new DatabaseError(DatabaseErrorCode.UnknownError, String(e), e);
    }
  };
}

export class DatabaseConnection {
  public readonly knex: Knex;
  private inInnerTransaction = false;

  private constructor(
    private readonly _baseKnex: Knex,
    public readonly logger: Logger,
    private _transaction?: Knex.Transaction,
  ) {
    if (_transaction) {
      this.knex = _transaction;
    } else {
      this.knex = _baseKnex.withUserParams({
        ..._baseKnex.userParams,
      });
    }

    this.knex.on("query", this.onQuery);
    this.knex.on("query-error", this.onQueryError);
    this.knex.on("query-response", this.onQueryResponse);
  }

  private readonly onQuery = (data: Obj): void => {
    if (this.inInnerTransaction) {
      return;
    }

    this.logger.trace({
      sql: data["sql"],
      bindings: data["bindings"],
    }, "Database query");
  };

  private readonly onQueryError = (error: Obj, data: Obj): void => {
    if (this.inInnerTransaction) {
      return;
    }

    this.logger.error({
      sql: data["sql"],
      bindings: data["bindings"],
      error,
    }, error["detail"]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly onQueryResponse = (response: any, data: Obj): void => {
    if (this.inInnerTransaction) {
      return;
    }

    let {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      _types,
      ...result
    } = response;

    this.logger.trace({
      sql: data["sql"],
      bindings: data["bindings"],
      response: result,
    }, "Database query response");
  };

  public clone(logger: Logger): DatabaseConnection {
    if (this.isInTransaction) {
      throw new Error("Cannot clone while in a transaction.");
    }

    return new DatabaseConnection(this._baseKnex, logger);
  }

  public async migrate(): Promise<void> {
    if (this.isInTransaction) {
      throw new Error("Cannot migrate while in a transaction.");
    }

    let migrateConfig = {
      migrationSource: new Migrations(this.logger.child("migration")),
    };

    await this.knex.migrate.latest(migrateConfig);
  }

  public forUser(user: UserRef): UserScopedConnection {
    return new UserScopedConnection(this, user);
  }

  public get isInTransaction(): boolean {
    return !!this._transaction;
  }

  public ensureTransaction<R>(...args: Named<TxnFn<DatabaseConnection, R>>): Promise<R> {
    let [name, transactionFn] = named(args);

    if (this.isInTransaction) {
      return transactionFn(this);
    }

    return this.inTransaction(name, transactionFn);
  }

  public inTransaction<R>(...args: Named<TxnFn<DatabaseConnection, R>>): Promise<R> {
    let [name, transactionFn] = named(args);

    this.logger.trace({
      inner: name,
    }, "Entering transaction.");
    try {
      let base = this._transaction ?? this._baseKnex;
      return base.transaction(async (trx: Knex.Transaction): Promise<R> => {
        if (this.isInTransaction) {
          this.inInnerTransaction = true;
        }
        try {
          let result = await transactionFn(new DatabaseConnection(
            this._baseKnex,
            this.logger.withBindings({
              transaction: name,
            }),
            trx,
          ));

          this.inInnerTransaction = false;
          this.logger.trace({
            inner: name,
          }, "Committing transaction.");
          return result;
        } catch (e) {
          this.inInnerTransaction = false;
          this.logger.trace({
            inner: name,
          }, "Rolling back transaction.");

          throw e;
        }
      });
    } finally {
      this.inInnerTransaction = false;
    }
  }

  public get ref(): Knex.RefBuilder {
    // @ts-ignore
    return (...args: unknown[]) => this.knex.ref(...args);
  }

  public get raw(): Knex.RawBuilder {
    // @ts-ignore
    return (...args: unknown[]) => this.knex.raw(...args);
  }

  public destroy(): Promise<void> {
    if (this.isInTransaction) {
      throw new Error("Cannot destroy a transaction.");
    }

    return this.knex.destroy();
  }

  public readonly getMedia = wrapped(Unsafe.getMedia);
  public readonly withNewMediaFile = wrapped(Unsafe.withNewMediaFile);
  public readonly addAlternateFile = wrapped(Unsafe.addAlternateFile);
  public readonly getStorageConfig = wrapped(Unsafe.getStorageConfig);

  public readonly loginUser = wrapped(UserQueries.loginUser);
  public readonly createUser = wrapped(UserQueries.createUser);
  public readonly listUsers = wrapped(UserQueries.listUsers);

  public readonly listDeletedMedia = wrapped(Unsafe.listDeletedMedia);
  public readonly deleteMedia = wrapped(Unsafe.deleteMedia);
  public readonly getUnusedMediaFiles = wrapped(Unsafe.getUnusedMediaFiles);
  public readonly deleteMediaFiles = wrapped(Unsafe.deleteMediaFiles);
  public readonly listAlternateFiles = wrapped(Unsafe.listAlternateFiles);
  public readonly deleteAlternateFiles = wrapped(Unsafe.deleteAlternateFiles);
  public readonly getUserForMedia = wrapped(Unsafe.getUserForMedia);
  public readonly getOldMedia = wrapped(Unsafe.getOldMedia);

  public readonly getSharedSearch = wrapped(SearchQueries.getSharedSearch);
  public readonly sharedSearch = wrapped(SearchQueries.sharedSearch);
  public readonly getSearchMediaFile = wrapped(MediaQueries.getSearchMediaFile);
  public readonly getSearchMediaAlternates = wrapped(MediaQueries.getSearchMediaAlternates);

  public readonly seed = wrapped(seed);

  public static async connect(config: DatabaseConfig): Promise<DatabaseConnection> {
    let dbLogger = logger;

    dbLogger.trace({
      config,
    }, "Connecting to database.");

    let schema = process.env.NODE_ENV == "test" ? `test${process.pid}` : undefined;
    let auth = `${config.username}:${config.password}`;
    let host = `${config.host}:${config.port ?? 5432}`;

    let knexConfig: Knex.Config = {
      client: "pg",
      asyncStackTraces: ["test", "development"].includes(process.env.NODE_ENV ?? ""),
      connection: `postgres://${auth}@${host}/${config.database}`,
      searchPath: schema ? [schema] : undefined,
      log: {
        warn(message: string): void {
          dbLogger.warn(message);
        },

        error(message: string): void {
          dbLogger.error(message);
        },

        debug(message: string): void {
          dbLogger.debug(message);
        },

        deprecate(message: string): void {
          dbLogger.debug(message);
        },
      },
    };

    if (schema) {
      knexConfig["userParams"] = {
        schema,
      };
    }

    let knex = Knex(knexConfig);

    return new DatabaseConnection(knex, dbLogger);
  }
}

export class UserScopedConnection {
  public readonly logger: Logger;

  public constructor(protected connection: DatabaseConnection, public readonly user: UserRef) {
    this.logger = connection.logger.withBindings({
      user: this.user,
    });
  }

  public get knex(): Knex {
    return this.connection.knex;
  }

  public get ref(): Knex.RefBuilder {
    // @ts-ignore
    return (...args: unknown[]) => this.knex.ref(...args);
  }

  public get raw(): Knex.RawBuilder {
    // @ts-ignore
    return (...args: unknown[]) => this.knex.raw(...args);
  }

  public ensureTransaction<R>(...args: Named<TxnFn<UserScopedConnection, R>>): Promise<R> {
    let [name, transactionFn] = named(args);

    return this.connection.ensureTransaction(
      name,
      (dbConnection: DatabaseConnection): Promise<R> => {
        return transactionFn(dbConnection.forUser(this.user));
      },
    );
  }

  public inTransaction<R>(...args: Named<TxnFn<UserScopedConnection, R>>): Promise<R> {
    let [name, transactionFn] = named(args);

    return this.connection.inTransaction(name, (dbConnection: DatabaseConnection): Promise<R> => {
      return transactionFn(dbConnection.forUser(this.user));
    });
  }

  public checkRead(table: Table, ids: string[]): Promise<void> {
    return this.logger.child("checkRead").time(
      () => this.ensureTransaction(async function checkRead(userDb: UserScopedConnection) {
        if (ids.length == 0) {
          return;
        }

        let counts: {
          count: number
        }[];

        if (table == Table.Catalog) {
          counts = await userDb.knex(asTable(userDb.knex, ids, "Ids", "id"))
            .join(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), "Ids.id")
            .where(ref(Table.UserCatalog, "user"), userDb.user)
            .select({
              count: userDb.raw("CAST(COUNT(*) AS integer)"),
            });
        } else {
          let visible = from(userDb.knex, table)
            .whereIn(`${table}.catalog`, userDb.catalogs());

          if (table == Table.MediaInfo) {
            visible = visible.where(ref(Table.MediaInfo, "deleted"), false);
          }

          counts = await userDb.knex(asTable(userDb.knex, ids, "Ids", "id"))
            .join(visible.as("Visible"), "Ids.id", "Visible.id")
            .select({
              count: userDb.raw("CAST(COUNT(*) AS integer)"),
            });
        }

        if (!counts.length || counts[0].count != ids.length) {
          notfound(table);
        }
      }),
      Level.Trace,
      "Checked read permission.",
    );
  }

  public async checkWrite(table: Table, ids: string[]): Promise<void> {
    return this.logger.child("checkRead").time(
      () => this.ensureTransaction(async function checkRead(userDb: UserScopedConnection) {
        if (ids.length == 0) {
          return;
        }

        let counts: {
          writable: number;
          visible: number;
        }[];

        if (table == Table.Catalog) {
          let writable = userDb.raw("CAST(COUNT(*) FILTER (WHERE ??=true) AS integer)", [
            ref(Table.UserCatalog, "writable"),
          ]);

          counts = await userDb.knex(asTable(userDb.knex, ids, "Ids", "id"))
            .join(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), "Ids.id")
            .where(ref(Table.UserCatalog, "user"), userDb.user)
            .select({
              visible: userDb.raw("CAST(COUNT(*) AS integer)"),
              writable,
            });
        } else {
          let writable = userDb.raw("CAST(COUNT(*) FILTER (WHERE ??=?) AS integer)", [
            ref(Table.UserCatalog, "writable"),
            true,
          ]);

          let query = userDb.knex(asTable(userDb.knex, ids, "Ids", "id"))
            .join(table, `${table}.id`, "Ids.id")
            .join(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), `${table}.catalog`)
            .where(ref(Table.UserCatalog, "user"), userDb.user);

          if (table == Table.MediaInfo) {
            query = query.where(ref(Table.MediaInfo, "deleted"), false);
          }

          counts = await query.select({
            visible: userDb.raw("CAST(COUNT(*) AS integer)"),
            writable,
          });
        }

        if (!counts.length || counts[0].visible != ids.length) {
          notfound(table);
        }

        if (counts[0].writable != ids.length) {
          notwritable(table);
        }
      }),
      Level.Trace,
      "Checked read permission.",
    );
  }

  public catalogs(): Knex.QueryBuilder<TableRecord<Table.UserCatalog>, string> {
    return from(this.knex, Table.UserCatalog)
      .where("user", this.user)
      .select("catalog");
  }

  public writableCatalogs(): Knex.QueryBuilder<TableRecord<Table.UserCatalog>, string> {
    return from(this.knex, Table.UserCatalog)
      .where("user", this.user)
      .where("writable", true)
      .select("catalog");
  }

  public readonly getUser = wrapped(UserQueries.getUser);

  public readonly listStorage = wrapped(CatalogQueries.listStorage);
  public readonly createStorage = wrapped(CatalogQueries.createStorage);

  public readonly listCatalogs = wrapped(CatalogQueries.listCatalogs);
  public readonly createCatalog = wrapped(CatalogQueries.createCatalog);
  public readonly editCatalog = wrapped(CatalogQueries.editCatalog);
  public readonly listMediaInCatalog = wrapped(CatalogQueries.listMediaInCatalog);

  public readonly listAlbums = wrapped(CatalogQueries.listAlbums);
  public readonly createAlbum = wrapped(CatalogQueries.createAlbum);
  public readonly editAlbum = wrapped(CatalogQueries.editAlbum);
  public readonly deleteAlbums = wrapped(CatalogQueries.deleteAlbums);
  public readonly listMediaInAlbum = wrapped(CatalogQueries.listMediaInAlbum);

  public readonly listTags = wrapped(CatalogQueries.listTags);
  public readonly createTag = wrapped(CatalogQueries.createTag);
  public readonly editTag = wrapped(CatalogQueries.editTag);
  public readonly deleteTags = wrapped(CatalogQueries.deleteTags);
  public readonly buildTags = wrapped(CatalogQueries.buildTags);

  public readonly listPeople = wrapped(CatalogQueries.listPeople);
  public readonly createPerson = wrapped(CatalogQueries.createPerson);
  public readonly editPerson = wrapped(CatalogQueries.editPerson);
  public readonly deletePeople = wrapped(CatalogQueries.deletePeople);

  public readonly getMediaAlbums = wrapped(Joins.getMediaAlbums);
  public readonly getMediaTags = wrapped(Joins.getMediaTags);
  public readonly getMediaPeople = wrapped(Joins.getMediaPeople);
  public readonly addMediaRelations = wrapped(Joins.addMediaRelations);
  public readonly removeMediaRelations = wrapped(Joins.removeMediaRelations);
  public readonly setMediaRelations = wrapped(Joins.setMediaRelations);
  public readonly setRelationMedia = wrapped(Joins.setRelationMedia);
  public readonly setPersonLocations = wrapped(Joins.setPersonLocations);

  public readonly createMedia = wrapped(MediaQueries.createMedia);
  public readonly editMedia = wrapped(MediaQueries.editMedia);
  public readonly getMedia = wrapped(MediaQueries.getMedia);
  public readonly listAlternateFiles = wrapped(MediaQueries.listAlternateFiles);
  public readonly getMediaAlternates = wrapped(MediaQueries.getMediaAlternates);
  public readonly getMediaFile = wrapped(MediaQueries.getMediaFile);
  public readonly deleteMedia = wrapped(MediaQueries.deleteMedia);
  public readonly searchMedia = wrapped(SearchQueries.searchMedia);

  public readonly listSavedSearches = wrapped(SearchQueries.listSavedSearches);
  public readonly createSavedSearch = wrapped(SearchQueries.createSavedSearch);
  public readonly editSavedSearch = wrapped(SearchQueries.editSavedSearch);
  public readonly deleteSavedSearches = wrapped(SearchQueries.deleteSavedSearches);
}
