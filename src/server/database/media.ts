import Knex from "knex";
import moment from "moment-timezone";

import { metadataColumns } from "../../model/models";
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
    uploaded: ref(Table.MediaInfo, "uploaded"),
    mimetype: ref(Table.MediaInfo, "mimetype"),
    width: ref(Table.MediaInfo, "width"),
    height: ref(Table.MediaInfo, "height"),
    duration: ref(Table.MediaInfo, "duration"),
    fileSize: ref(Table.MediaInfo, "fileSize"),
    frameRate: ref(Table.MediaInfo, "frameRate"),
    bitRate: ref(Table.MediaInfo, "bitRate"),
  };

  for (let field of metadataColumns) {
    mappings[field] = coalesce(knex, [
      knex.ref(ref(Table.Media, field)),
      knex.ref(ref(Table.MediaInfo, field)),
    ]);
  }

  return from(knex, Table.Media)
    .leftJoin(Table.MediaInfo, ref(Table.Media, "id"), ref(Table.MediaInfo, "media"))
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
