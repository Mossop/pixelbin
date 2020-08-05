import { ObjectModel } from "../../model";
import { DatabaseConnection } from "./connection";
import { uuid } from "./id";
import { from, into, select } from "./queries";
import { Table, Tables, ref, DBAPI, intoDBTypes, intoAPITypes } from "./types";

export async function getMedia(
  this: DatabaseConnection,
  id: DBAPI<Tables.Media>["id"],
): Promise<DBAPI<Tables.Media> | null> {
  let results = await from(this.knex, Table.Media).where({ id }).select("*");

  if (results.length == 0) {
    return null;
  } else if (results.length != 1) {
    throw new Error("Found multiple matching media records.");
  } else {
    return intoAPITypes(results[0]);
  }
}

export type UploadedMediaInfo = DBAPI<Omit<Tables.UploadedMedia, "processVersion">>;
export async function withNewUploadedMedia<T>(
  this: DatabaseConnection,
  media: DBAPI<Tables.UploadedMedia>["media"],
  data: DBAPI<Omit<Tables.UploadedMedia, "id" | "media">>,
  operation: (dbConnection: DatabaseConnection, uploadedMedia: UploadedMediaInfo) => Promise<T>,
): Promise<T> {
  return this.inTransaction(async (dbConnection: DatabaseConnection): Promise<T> => {
    let results = await into(dbConnection.knex, Table.UploadedMedia).insert({
      ...intoDBTypes(data),
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
      ...ObjectModel.metadataColumns,
    ]);

    if (results.length) {
      return operation(dbConnection, intoAPITypes(results[0]));
    }

    throw new Error("Invalid media ID passed to withNewUploadedMedia");
  });
}

export async function addAlternateFile(
  this: DatabaseConnection,
  uploadedMedia: DBAPI<Tables.UploadedMedia>["id"],
  data: DBAPI<Omit<Tables.AlternateFile, "id" | "uploadedMedia">>,
): Promise<void> {
  await into(this.knex, Table.AlternateFile).insert({
    ...intoDBTypes(data),
    id: await uuid("F"),
    uploadedMedia,
  });
}

export async function getStorageConfig(
  this: DatabaseConnection,
  catalog: DBAPI<Tables.Catalog>["id"],
): Promise<DBAPI<Tables.Storage>> {
  let results = await select(from(this.knex, Table.Storage)
    .join(Table.Catalog, ref(Table.Catalog, "storage"), ref(Table.Storage, "id"))
    .where(ref(Table.Catalog, "id"), catalog), Table.Storage);

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid catalog ID passed to getStorageConfig.");
}