import Knex from "knex";
import moment from "moment-timezone";

import { metadataColumns, AlternateFileType } from "../../model/models";
import { connection } from "./connection";
import { coalesce } from "./functions";
import { mediaId } from "./id";
import { insertFromSelect, from, update } from "./queries";
import { Tables, Table, ref, UserRef } from "./types";
import { DBAPI, intoDBTypes, intoAPITypes } from "./types/meta";
import { Metadata } from "./types/tables";

export function fillMetadata<T>(data: T): T & Metadata {
  let result = { ...data };
  for (let field of metadataColumns) {
    if (!(field in result)) {
      result[field] = null;
    }
  }

  return result as T & Metadata;
}

function buildMediaView(knex: Knex): Knex.QueryBuilder {
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

  for (let field of metadataColumns) {
    mappings[field] = coalesce(knex, [
      knex.ref(ref(Table.Media, field)),
      knex.ref(ref(Table.UploadedMedia, field)),
    ]);
  }

  return from(knex, Table.Media)
    .leftJoin(Table.UploadedMedia, ref(Table.Media, "id"), ref(Table.UploadedMedia, "media"))
    .orderBy([
      { column: "id", order: "asc" },
      { column: "uploaded", order: "desc" },
    ])
    .distinctOn(ref(Table.Media, "id"))
    .select(mappings);
}

export async function createMedia(
  user: UserRef,
  catalog: DBAPI<Tables.Media>["catalog"],
  data: DBAPI<Omit<Tables.Media, "id" | "catalog" | "created">>,
): Promise<DBAPI<Tables.Media>> {
  let knex = await connection;

  let select = from(knex, Table.UserCatalog).where({
    user,
    catalog,
  });

  let results = await insertFromSelect(knex, Table.Media, select, {
    ...intoDBTypes(data),
    id: await mediaId("M"),
    catalog: knex.ref(ref(Table.UserCatalog, "catalog")),
    created: moment().utc().toISOString(),
  }).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or catalog passed to createMedia");
}

export async function editMedia(
  user: UserRef,
  id: DBAPI<Tables.Media>["id"],
  data: DBAPI<Partial<Tables.Media>>,
): Promise<DBAPI<Tables.Media>> {
  let knex = await connection;
  let catalogs = from(knex, Table.UserCatalog).where("user", user).select("catalog");

  let {
    id: removedId,
    catalog: removedCatalog,
    created: removedCreated,
    ...mediaUpdateData
  } = data;
  let results = await update(
    Table.Media,
    knex.where("id", id).andWhere("catalog", "in", catalogs),
    intoDBTypes(mediaUpdateData),
  ).returning("*");

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid user or album passed to editAlbum");
}

export async function getMedia(
  user: UserRef,
  id: DBAPI<Tables.MediaWithInfo>["id"],
): Promise<DBAPI<Tables.MediaWithInfo> | null> {
  let knex = await connection;

  let results = await buildMediaView(knex).join(
    Table.UserCatalog,
    ref(Table.UserCatalog, "catalog"),
    ref(Table.Media, "catalog"),
  ).where({
    [ref(Table.UserCatalog, "user")]: user,
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
  user: UserRef,
  id: DBAPI<Tables.MediaWithInfo>["id"],
  type: AlternateFileType,
): Promise<DBAPI<Tables.AlternateFile>[]> {
  let knex = await connection;

  return from(knex, Table.AlternateFile).join((builder: Knex.QueryBuilder): void => {
    void builder.from(Table.Media)
      .leftJoin(Table.UploadedMedia, ref(Table.Media, "id"), ref(Table.UploadedMedia, "media"))
      .join(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Media, "catalog"))
      .orderBy([
        { column: ref(Table.UploadedMedia, "media"), order: "asc" },
        { column: ref(Table.UploadedMedia, "uploaded"), order: "desc" },
      ])
      .where({
        [ref(Table.UserCatalog, "user")]: user,
      })
      .distinctOn(ref(Table.UploadedMedia, "media"))
      .select(ref(Table.UploadedMedia))
      .as("Uploaded");
  }, ref(Table.AlternateFile, "uploadedMedia"), "Uploaded.id")
    .where(ref(Table.AlternateFile, "type"), type)
    .andWhere("Uploaded.media", id)
    .select(ref(Table.AlternateFile));
}
