import Knex from "knex";
import moment from "moment-timezone";

import { ObjectModel, AlternateFileType } from "../../model";
import { UserScopedConnection } from "./connection";
import { mediaId } from "./id";
import { insertFromSelect, from, update } from "./queries";
import {
  Tables,
  Table,
  ref,
  DBAPI,
  intoDBTypes,
  intoAPITypes,
} from "./types";

export function fillMetadata<T>(data: T): T & Tables.Metadata {
  let result = { ...data };
  for (let field of ObjectModel.metadataColumns) {
    if (!(field in result)) {
      result[field] = null;
    }
  }

  return result as T & Tables.Metadata;
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
  id: DBAPI<Tables.StoredMedia>["id"],
): Promise<DBAPI<Tables.StoredMedia> | null> {
  let results = await from(this.knex, Table.StoredMedia).join(
    Table.UserCatalog,
    ref(Table.UserCatalog, "catalog"),
    ref(Table.StoredMedia, "catalog"),
  ).where({
    [ref(Table.UserCatalog, "user")]: this.user,
    [ref(Table.StoredMedia, "id")]: id,
  }).select(ref(Table.StoredMedia));

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
  id: DBAPI<Tables.StoredMedia>["id"],
  type: AlternateFileType,
): Promise<DBAPI<Tables.AlternateFile>[]> {
  return from(this.knex, Table.AlternateFile).join((builder: Knex.QueryBuilder): void => {
    void builder.from(Table.Media)
      .leftJoin(Table.Original, ref(Table.Media, "id"), ref(Table.Original, "media"))
      .join(Table.UserCatalog, ref(Table.UserCatalog, "catalog"), ref(Table.Media, "catalog"))
      .orderBy([
        { column: ref(Table.Original, "media"), order: "asc" },
        { column: ref(Table.Original, "uploaded"), order: "desc" },
      ])
      .where({
        [ref(Table.UserCatalog, "user")]: this.user,
      })
      .distinctOn(ref(Table.Original, "media"))
      .select(ref(Table.Original))
      .as("Uploaded");
  }, ref(Table.AlternateFile, "original"), "Uploaded.id")
    .where(ref(Table.AlternateFile, "type"), type)
    .where("Uploaded.media", id)
    .select(ref(Table.AlternateFile));
}
