import { metadataColumns } from "../../model/models";
import { connection } from "./connection";
import { uuid } from "./id";
import { from, into } from "./queries";
import { Table, Tables } from "./types";
import { DBAPI, intoDBTypes, intoAPITypes } from "./types/meta";

export async function getMedia(id: DBAPI<Tables.Media>["id"]): Promise<DBAPI<Tables.Media> | null> {
  let results = await from(await connection, Table.Media).where({ id }).select("*");

  if (results.length == 0) {
    return null;
  } else if (results.length != 1) {
    throw new Error("Found multiple matching media records.");
  } else {
    return intoAPITypes(results[0]);
  }
}

export async function createMediaInfo(
  media: DBAPI<Tables.MediaInfo>["media"],
  data: DBAPI<Omit<Tables.MediaInfo, "id" | "media">>,
): Promise<DBAPI<Omit<Tables.MediaInfo, "processVersion">>> {
  let knex = await connection;

  let results = await into(knex, Table.MediaInfo).insert({
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
    ...metadataColumns,
  ]);

  if (results.length) {
    return intoAPITypes(results[0]);
  }

  throw new Error("Invalid media ID passed to createMediaInfo");
}
