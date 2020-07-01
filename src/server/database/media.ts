import Knex from "knex";
import moment from "moment";
import { customAlphabet } from "nanoid/async";

import { metadataColumns } from "../../model/models";
import { connection } from "./connection";
import { coalesce } from "./functions";
import { insertFromSelect, from, update } from "./queries";
import { Tables, Table, ref } from "./types";
import { Metadata } from "./types/tables";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 25);
async function uuid(start: string): Promise<string> {
  return start + ":" + await nanoid();
}

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
    processVersion: ref(Table.MediaInfo, "processVersion"),
    uploaded: ref(Table.MediaInfo, "uploaded"),
    mimetype: ref(Table.MediaInfo, "mimetype"),
    width: ref(Table.MediaInfo, "width"),
    height: ref(Table.MediaInfo, "height"),
    duration: ref(Table.MediaInfo, "duration"),
    fileSize: ref(Table.MediaInfo, "fileSize"),
  };

  for (let field of metadataColumns) {
    mappings[field] = coalesce(knex, [
      knex.ref(ref(Table.Media, field)),
      knex.ref(ref(Table.MediaInfo, field)),
    ]);
  }

  return from(knex, Table.Media).leftJoin((qb: Knex.QueryBuilder): void => {
    void qb.from(Table.MediaInfo)
      .groupBy("media")
      .select("media", knex.raw("MAX(\"uploaded\") as current"))
      .as("NewestInfo");
  }, {
    [ref(Table.Media, "id")]: "NewestInfo.media",
  }).leftJoin(Table.MediaInfo, {
    [ref(Table.MediaInfo, "uploaded")]: "NewestInfo.current",
    [ref(Table.MediaInfo, "media")]: ref(Table.Media, "id"),
  }).select(mappings);
}

export async function createMedia(
  user: string,
  catalog: string,
  data: Omit<Tables.Media, "id" | "catalog" | "created">,
): Promise<Tables.Media> {
  let knex = await connection;

  let select = from(knex, Table.UserCatalog).where({
    user,
    catalog,
  });

  let results = await insertFromSelect(knex, Table.Media, select, {
    ...data,
    id: await uuid("M"),
    catalog: knex.ref(ref(Table.UserCatalog, "catalog")),
    created: moment(),
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or catalog passed to createMedia");
}

export async function editMedia(
  user: string,
  id: string,
  data: Partial<Omit<Tables.Media, "id" | "catalog" | "created">>,
): Promise<Tables.Media> {
  let knex = await connection;
  let catalogs = from(knex, Table.UserCatalog).where("user", user).select("catalog");

  let results = await update(Table.Media, knex.where("id", id)
    .andWhere("catalog", "in", catalogs), {
    ...data,
    id: undefined,
    catalog: undefined,
    created: undefined,
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or album passed to editAlbum");
}

export async function createMediaInfo(
  user: string,
  media: string,
  data: Omit<Tables.MediaInfo, "id" | "media" | "uploaded">,
): Promise<Tables.MediaInfo> {
  let knex = await connection;

  let select = from(knex, Table.Media)
    .join(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Media, "catalog"))
    .where({
      user,
      id: media,
    });

  let results = await insertFromSelect(knex, Table.MediaInfo, select, {
    ...data,
    id: await uuid("I"),
    media: knex.ref(ref(Table.Media, "id")),
    uploaded: moment(),
  }).returning("*");

  if (results.length) {
    return results[0];
  }

  throw new Error("Invalid user or catalog passed to createMediaInfo");
}

export async function getMedia(user: string, id: string): Promise<Tables.MediaWithInfo | null> {
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
    return results[0] as Tables.MediaWithInfo;
  }
}
