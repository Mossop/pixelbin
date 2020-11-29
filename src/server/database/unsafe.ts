import type { ObjectModel } from "../../model";
import { CURRENT_PROCESS_VERSION } from "../../model";
import type { DatabaseConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode, notfound } from "./error";
import { uuid } from "./id";
import { from, into } from "./queries";
import type { Tables } from "./types";
import {
  Table,
  ref,
  intoDBTypes,
  buildTimeZoneFields,
  applyTimeZoneFields,
} from "./types";

export async function getMedia(
  this: DatabaseConnection,
  id: Tables.MediaView["id"],
): Promise<Tables.MediaView | null> {
  let results = await from(this.knex, Table.MediaView).where({ id }).select("*");

  if (results.length == 0) {
    return null;
  } else if (results.length != 1) {
    throw new Error("Found multiple matching media records.");
  } else {
    return results[0];
  }
}

export async function withNewMediaFile<T>(
  this: DatabaseConnection,
  media: Tables.MediaView["id"],
  metadata: Omit<Tables.MediaFile, "id" | "media">,
  operation: (
    dbConnection: DatabaseConnection,
    mediaFile: Tables.MediaFile,
  ) => Promise<T>,
): Promise<T> {
  return this.inTransaction(
    async function withNewMediaFile(dbConnection: DatabaseConnection): Promise<T> {
      let newId = await uuid("I");

      let results: Tables.MediaFile[];
      try {
        results = await into(dbConnection.knex, Table.MediaFile).insert({
          ...intoDBTypes(buildTimeZoneFields(metadata)),
          id: newId,
          media,
        }).returning("*");
      } catch (error) {
        if (error.table && error.constraint && error.constraint.startsWith("foreign_")) {
          notfound(error.constraint.substring(8));
        }

        throw error;
      }

      if (results.length == 0) {
        throw new DatabaseError(
          DatabaseErrorCode.UnknownError,
          "Failed to insert MediaFile record.",
        );
      }

      return operation(dbConnection, applyTimeZoneFields(results[0]));
    },
  );
}

export async function addAlternateFile(
  this: DatabaseConnection,
  mediaFile: Tables.MediaFile["id"],
  data: Omit<Tables.AlternateFile, "id" | "mediaFile">,
): Promise<Tables.AlternateFile> {
  let results = await into(this.knex, Table.AlternateFile).insert({
    ...intoDBTypes(data),
    id: await uuid("F"),
    mediaFile,
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Failed creating AlternateFile.");
}

export async function getStorageConfig(
  this: DatabaseConnection,
  catalog: Tables.Catalog["id"],
): Promise<Tables.Storage> {
  let results = await from(this.knex, Table.Storage)
    .join(Table.Catalog, ref(Table.Catalog, "storage"), ref(Table.Storage, "id"))
    .where(ref(Table.Catalog, "id"), catalog)
    .select<Tables.Storage[]>(ref(Table.Storage));

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid catalog ID passed to getStorageConfig.");
}

export async function listDeletedMedia(
  this: DatabaseConnection,
): Promise<Tables.MediaInfo[]> {
  return this.loggedQuery(from(this.knex, Table.MediaInfo)
    .where(this.knex.raw("??", [ref(Table.MediaInfo, "deleted")]))
    .select(ref(Table.MediaInfo)), "listDeletedMedia");
}

export async function deleteMedia(
  this: DatabaseConnection,
  media: string[],
): Promise<void> {
  await from(this.knex, Table.MediaInfo)
    .whereIn(ref(Table.MediaInfo, "id"), media)
    .where(ref(Table.MediaInfo, "deleted"), true)
    .del();
}

export async function deleteMediaFiles(
  this: DatabaseConnection,
  mediaFiles: string[],
): Promise<void> {
  await from(this.knex, Table.MediaFile)
    .whereIn(ref(Table.MediaFile, "id"), mediaFiles)
    .del();
}

export async function getUnusedMediaFiles(
  this: DatabaseConnection,
): Promise<(Tables.MediaFile & { catalog: string })[]> {
  let currentFiles = this.knex(Table.MediaFile)
    .orderBy([
      { column: ref(Table.MediaFile, "media"), order: "asc" },
      { column: ref(Table.MediaFile, "uploaded"), order: "desc" },
      { column: ref(Table.MediaFile, "processVersion"), order: "desc" },
    ])
    .distinctOn(ref(Table.MediaFile, "media"))
    .select(ref(Table.MediaFile, "id"));

  return this.loggedQuery(from(this.knex, Table.MediaFile)
    .join(Table.MediaInfo, ref(Table.MediaInfo, "id"), ref(Table.MediaFile, "media"))
    .whereNotIn(ref(Table.MediaFile, "id"), currentFiles)
    .orWhere(this.raw("??", [ref(Table.MediaInfo, "deleted")]))
    .select(ref(Table.MediaFile), ref(Table.MediaInfo, "catalog")), "getUnusedMediaFiles");
}

export async function deleteAlternateFiles(
  this: DatabaseConnection,
  alternates: string[],
): Promise<void> {
  await from(this.knex, Table.AlternateFile)
    .whereIn(ref(Table.AlternateFile, "id"), alternates)
    .del();
}

export async function listAlternateFiles(
  this: DatabaseConnection,
  mediaFile: string,
): Promise<Tables.AlternateFile[]> {
  return this.loggedQuery(from(this.knex, Table.AlternateFile)
    .where(ref(Table.AlternateFile, "mediaFile"), mediaFile)
    .select(ref(Table.AlternateFile)), "listAlternateFiles");
}

export async function getUserForMedia(
  this: DatabaseConnection,
  mediaId: string,
): Promise<ObjectModel.User> {
  let users = await this.loggedQuery(from(this.knex, Table.MediaInfo)
    .join(Table.Catalog, ref(Table.Catalog, "id"), ref(Table.MediaInfo, "catalog"))
    .join(Table.Storage, ref(Table.Catalog, "storage"), ref(Table.Storage, "id"))
    .join(Table.User, ref(Table.User, "email"), ref(Table.Storage, "owner"))
    .where(ref(Table.MediaInfo, "id"), mediaId)
    .select<Tables.User[]>(ref(Table.User)), "getUserForMedia");

  if (users.length != 1) {
    throw new DatabaseError(DatabaseErrorCode.MissingValue, `Media ${mediaId} does not exist.`);
  }

  let {
    password,
    ...user
  } = users[0];
  return user;
}

export async function getOldMedia(
  this: DatabaseConnection,
): Promise<string[]> {
  return this.loggedQuery(from(this.knex, Table.MediaView)
    .where(
      this.raw("(??->'processVersion')::integer", [ref(Table.MediaView, "file")]),
      "<",
      CURRENT_PROCESS_VERSION,
    )
    .pluck(ref(Table.MediaView, "id")), "getOldMedia");
}
