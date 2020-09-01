import Knex from "knex";
import moment from "moment-timezone";

import { AlternateFileType, emptyMetadata } from "../../model";
import { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { mediaId } from "./id";
import { insertFromSelect, from, update } from "./queries";
import {
  Tables,
  Table,
  ref,
  intoDBTypes,
  intoAPITypes,
  Media,
  UnprocessedMedia,
} from "./types";
import { filterColumns } from "./utils";

export function fillMetadata<T>(data: T): T & Tables.Metadata {
  return {
    ...emptyMetadata(),
    ...data,
  };
}

export async function createMedia(
  this: UserScopedConnection,
  catalog: Tables.Media["catalog"],
  data: Omit<Tables.Media, "id" | "catalog" | "created">,
): Promise<UnprocessedMedia> {
  let select = from(this.knex, Table.UserCatalog).where({
    user: this.user,
    catalog,
  });

  let results = await insertFromSelect(this.knex, Table.Media, select, intoDBTypes({
    ...filterColumns(Table.Media, data),
    id: await mediaId(),
    catalog: this.connection.ref(ref(Table.UserCatalog, "catalog")),
    created: moment(),
  })).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Media record.");
  }

  return {
    ...intoAPITypes(results[0]),
    albums: [],
    tags: [],
    people: [],
  };
}

export async function editMedia(
  this: UserScopedConnection,
  id: Tables.Media["id"],
  data: Partial<Tables.Media>,
): Promise<Media> {
  return this.inTransaction(
    async (userDb: UserScopedConnection): Promise<Media> => {
      let catalogs = from(userDb.knex, Table.UserCatalog)
        .where("user", userDb.user)
        .select("catalog");

      let {
        id: removedId,
        catalog: removedCatalog,
        created: removedCreated,
        ...mediaUpdateData
      } = data;
      let updateCount = await update(
        Table.Media,
        userDb.knex.where("id", id).where("catalog", "in", catalogs),
        intoDBTypes(filterColumns(Table.Media, mediaUpdateData)),
      );

      if (updateCount != 1) {
        throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Media record.");
      }

      return (await userDb.getMedia([id]))[0];
    },
  );
}

export async function getMedia(
  this: UserScopedConnection,
  ids: Tables.StoredMedia["id"][],
): Promise<Media[]> {
  let results = await from(this.knex, Table.StoredMediaDetail)
    .join(
      Table.UserCatalog,
      ref(Table.UserCatalog, "catalog"),
      ref(Table.StoredMediaDetail, "catalog"),
    )
    .where(ref(Table.UserCatalog, "user"), this.user)
    .whereIn(ref(Table.StoredMediaDetail, "id"), ids)
    .select<Tables.StoredMedia[]>(ref(Table.StoredMediaDetail));

  let sorted = results.map((item: Tables.StoredMedia): Media => {
    let forApi = intoAPITypes(item);

    if (forApi.uploaded) {
      return forApi;
    }

    let {
      uploaded,
      fileSize,
      mimetype,
      width,
      height,
      duration,
      frameRate,
      bitRate,
      ...unprocessed
    } = forApi;

    return unprocessed;
  });
  sorted.sort((a: Media, b: Media): number => {
    return ids.indexOf(a.id) - ids.indexOf(b.id);
  });
  return sorted;
}

export async function listAlternateFiles(
  this: UserScopedConnection,
  id: Tables.StoredMedia["id"],
  type: AlternateFileType,
): Promise<Tables.AlternateFile[]> {
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
