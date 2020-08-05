import Knex from "knex";
import moment from "moment-timezone";

import { ObjectModel, AlternateFileType } from "../../model";
import { DatabaseConnection, UserScopedConnection } from "./connection";
import { mediaId } from "./id";
import { insertFromSelect, from, update } from "./queries";
import {
  Tables,
  Table,
  ref,
  AllOrNulls,
  DBAPI,
  intoDBTypes,
  intoAPITypes,
  DBRecord,
  QueryBuilder,
} from "./types";

export type MediaWithInfo = Tables.Media & AllOrNulls<
  Omit<Tables.UploadedMedia, "id" | "media" | "processVersion" | "fileName">
>;

export function fillMetadata<T>(data: T): T & Tables.Metadata {
  let result = { ...data };
  for (let field of ObjectModel.metadataColumns) {
    if (!(field in result)) {
      result[field] = null;
    }
  }

  return result as T & Tables.Metadata;
}

function buildMediaView(connection: DatabaseConnection): QueryBuilder<DBRecord<MediaWithInfo>> {
  let mappings = {
    id: ref(Table.Media, "id"),
    catalog: ref(Table.Media, "catalog"),
    created: ref(Table.Media, "created"),
    uploaded: ref(Table.UploadedMedia, "uploaded"),
    mimetype: ref(Table.UploadedMedia, "mimetype"),
    width: ref(Table.UploadedMedia, "width"),
    height: ref(Table.UploadedMedia, "height"),
    duration: ref(Table.UploadedMedia, "duration"),
    fileSize: ref(Table.UploadedMedia, "fileSize"),
    frameRate: ref(Table.UploadedMedia, "frameRate"),
    bitRate: ref(Table.UploadedMedia, "bitRate"),
  };

  for (let field of ObjectModel.metadataColumns) {
    mappings[field] = connection.coalesce([
      connection.ref(ref(Table.Media, field)),
      connection.ref(ref(Table.UploadedMedia, field)),
    ]);
  }

  return from(connection.knex, Table.Media)
    .leftJoin(Table.UploadedMedia, ref(Table.Media, "id"), ref(Table.UploadedMedia, "media"))
    .orderBy([
      { column: "id", order: "asc" },
      { column: "uploaded", order: "desc" },
    ])
    .distinctOn(ref(Table.Media, "id"))
    .select(mappings) as QueryBuilder<DBRecord<MediaWithInfo>>;
}

export async function createMedia(
  this: UserScopedConnection,
  catalog: DBAPI<Tables.Media>["catalog"],
  data: DBAPI<Omit<Tables.Media, "id" | "catalog" | "created">>,
): Promise<DBAPI<Tables.Media>> {
  let select = from(this.knex, Table.UserCatalog).where({
    user: this.user,
    catalog,
  });

  let results = await insertFromSelect(this.knex, Table.Media, select, {
    ...intoDBTypes(data),
    id: await mediaId(),
    catalog: this.connection.ref(ref(Table.UserCatalog, "catalog")),
    created: moment().utc().toISOString(),
  }).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or catalog passed to createMedia");
}

export async function editMedia(
  this: UserScopedConnection,
  id: DBAPI<Tables.Media>["id"],
  data: DBAPI<Partial<Tables.Media>>,
): Promise<DBAPI<Tables.Media>> {
  let catalogs = from(this.knex, Table.UserCatalog).where("user", this.user).select("catalog");

  let {
    id: removedId,
    catalog: removedCatalog,
    created: removedCreated,
    ...mediaUpdateData
  } = data;
  let results = await update(
    Table.Media,
    this.knex.where("id", id).where("catalog", "in", catalogs),
    intoDBTypes(mediaUpdateData),
  ).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or album passed to editAlbum");
}

export async function getMedia(
  this: UserScopedConnection,
  id: DBAPI<MediaWithInfo>["id"],
): Promise<DBAPI<MediaWithInfo> | null> {
  let results = await buildMediaView(this.connection).join(
    Table.UserCatalog,
    ref(Table.UserCatalog, "catalog"),
    ref(Table.Media, "catalog"),
  ).where({
    [ref(Table.UserCatalog, "user")]: this.user,
    [ref(Table.Media, "id")]: id,
  });

  if (results.length == 0) {
    return null;
  } else if (results.length != 1) {
    throw new Error("Found multiple matching media records.");
  } else {
    return intoAPITypes(results[0]);
  }
}

export async function listAlternateFiles(
  this: UserScopedConnection,
  id: DBAPI<MediaWithInfo>["id"],
  type: AlternateFileType,
): Promise<DBAPI<Tables.AlternateFile>[]> {
  return from(this.knex, Table.AlternateFile).join((builder: Knex.QueryBuilder): void => {
    void builder.from(Table.Media)
      .leftJoin(Table.UploadedMedia, ref(Table.Media, "id"), ref(Table.UploadedMedia, "media"))
      .join(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Media, "catalog"))
      .orderBy([
        { column: ref(Table.UploadedMedia, "media"), order: "asc" },
        { column: ref(Table.UploadedMedia, "uploaded"), order: "desc" },
      ])
      .where({
        [ref(Table.UserCatalog, "user")]: this.user,
      })
      .distinctOn(ref(Table.UploadedMedia, "media"))
      .select(ref(Table.UploadedMedia))
      .as("Uploaded");
  }, ref(Table.AlternateFile, "uploadedMedia"), "Uploaded.id")
    .where(ref(Table.AlternateFile, "type"), type)
    .where("Uploaded.media", id)
    .select(ref(Table.AlternateFile));
}
