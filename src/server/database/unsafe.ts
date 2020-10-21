import { MetadataColumns } from "../../model";
import { DatabaseConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode, notfound } from "./error";
import { uuid } from "./id";
import { from, into } from "./queries";
import {
  Table,
  Tables,
  ref,
  intoDBTypes,
  intoAPITypes,
  buildTimeZoneFields,
  applyTimeZoneFields,
} from "./types";

export async function getMedia(
  this: DatabaseConnection,
  id: Tables.Media["id"],
): Promise<Tables.Media | null> {
  let results = await from(this.knex, Table.Media).where({ id }).select("*");

  if (results.length == 0) {
    return null;
  } else if (results.length != 1) {
    throw new Error("Found multiple matching media records.");
  } else {
    return intoAPITypes(results[0]);
  }
}

export type OriginalInfo = Omit<Tables.Original, "processVersion">;
export async function withNewOriginal<T>(
  this: DatabaseConnection,
  media: Tables.Original["media"],
  data: Omit<Tables.Original, "id" | "media">,
  operation: (dbConnection: DatabaseConnection, original: OriginalInfo) => Promise<T>,
): Promise<T> {
  return this.inTransaction(
    async function withNewOriginal(dbConnection: DatabaseConnection): Promise<T> {
      let results: OriginalInfo[];
      try {
        results = await into(dbConnection.knex, Table.Original).insert({
          ...intoDBTypes(buildTimeZoneFields(data)),
          id: await uuid("I"),
          media,
        }).returning([
          "id",
          "media",
          "uploaded",
          "mimetype",
          "width",
          "height",
          "duration",
          "frameRate",
          "bitRate",
          "fileSize",
          "fileName",
          ...Object.keys(MetadataColumns),
        ]) as OriginalInfo[];
      } catch (e) {
        notfound(Table.Media);
      }

      if (results.length) {
        return operation(dbConnection, applyTimeZoneFields(intoAPITypes(results[0])));
      }

      throw new DatabaseError(
        DatabaseErrorCode.UnknownError,
        "Failed to insert OriginalInfo record.",
      );
    },
  );
}

export async function addAlternateFile(
  this: DatabaseConnection,
  original: Tables.Original["id"],
  data: Omit<Tables.AlternateFile, "id" | "original">,
): Promise<void> {
  await into(this.knex, Table.AlternateFile).insert({
    ...intoDBTypes(data),
    id: await uuid("F"),
    original,
  });
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
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid catalog ID passed to getStorageConfig.");
}

export async function listDeletedMedia(
  this: DatabaseConnection,
): Promise<Tables.StoredMedia[]> {
  return from(this.knex, Table.StoredMedia)
    .where(ref(Table.StoredMedia, "deleted"), true)
    .select(ref(Table.StoredMedia));
}

export async function deleteMedia(
  this: DatabaseConnection,
  media: string,
): Promise<void> {
  await from(this.knex, Table.Media)
    .where(ref(Table.Media, "id"), media)
    .where(ref(Table.Media, "deleted"), true)
    .del();
}

export async function deleteOriginal(
  this: DatabaseConnection,
  original: string,
): Promise<void> {
  await from(this.knex, Table.Original)
    .where(ref(Table.Original, "id"), original)
    .del();
}

export async function getUnusedOriginals(
  this: DatabaseConnection,
): Promise<(Tables.Original & { catalog: string })[]> {
  return from(this.knex, Table.Original)
    .join(Table.StoredMedia, ref(Table.StoredMedia, "id"), ref(Table.Original, "media"))
    .whereNot(ref(Table.Original, "id"), this.ref(ref(Table.StoredMedia, "original")))
    .select(ref(Table.Original), ref(Table.StoredMedia, "catalog"));
}

export async function deleteAlternateFile(
  this: DatabaseConnection,
  alternate: string,
): Promise<void> {
  await from(this.knex, Table.AlternateFile)
    .where(ref(Table.AlternateFile, "id"), alternate)
    .del();
}

export async function listAlternateFiles(
  this: DatabaseConnection,
  original: string,
): Promise<Tables.AlternateFile[]> {
  return from(this.knex, Table.AlternateFile)
    .where(ref(Table.AlternateFile, "original"), original)
    .select(ref(Table.AlternateFile));
}
