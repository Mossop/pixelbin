import Knex from "knex";

import { AlternateFileType, emptyMetadata } from "../../model";
import { now } from "../../utils";
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
  buildTimeZoneFields,
  applyTimeZoneFields,
} from "./types";
import { filterColumns } from "./utils";

export function fillMetadata<T>(data: T): T & Tables.Metadata {
  return {
    ...emptyMetadata(),
    ...data,
  };
}

export function intoMedia(item: Tables.StoredMedia): Media {
  let forApi = applyTimeZoneFields(intoAPITypes(item));

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
    original,
    fileName,
    ...unprocessed
  } = forApi;

  return unprocessed;
}

export async function createMedia(
  this: UserScopedConnection,
  catalog: Tables.Media["catalog"],
  data: Omit<Tables.Media, "id" | "catalog" | "created">,
): Promise<UnprocessedMedia> {
  return this.inTransaction(
    async (userDb: UserScopedConnection): Promise<Media> => {
      let select = from(userDb.knex, Table.UserCatalog).where({
        user: this.user,
        catalog,
      });

      let ids = await insertFromSelect(
        userDb.knex,
        Table.Media,
        select,
        intoDBTypes(buildTimeZoneFields({
          ...filterColumns(Table.Media, data),
          id: await mediaId(),
          catalog: userDb.connection.ref(ref(Table.UserCatalog, "catalog")),
          created: now(),
        })),
      ).returning("id");

      if (!ids.length) {
        throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Media record.");
      }

      let results = await userDb.getMedia(ids);
      if (!results[0]) {
        throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Media record.");
      }

      return results[0];
    },
  );
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
        intoDBTypes(buildTimeZoneFields(filterColumns(Table.Media, mediaUpdateData))),
      );

      if (updateCount != 1) {
        throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to edit Media record.");
      }

      let edited = (await userDb.getMedia([id]))[0];
      if (!edited) {
        throw new DatabaseError(
          DatabaseErrorCode.UnknownError,
          "Failed to find edited Media record.",
        );
      }

      return edited;
    },
  );
}

export async function getMedia(
  this: UserScopedConnection,
  ids: Tables.StoredMedia["id"][],
): Promise<(Media | null)[]> {
  let foundMedia = await from(this.knex, Table.StoredMediaDetail)
    .join(
      Table.UserCatalog,
      ref(Table.UserCatalog, "catalog"),
      ref(Table.StoredMediaDetail, "catalog"),
    )
    .where(ref(Table.UserCatalog, "user"), this.user)
    .whereIn(ref(Table.StoredMediaDetail, "id"), ids)
    .select<Tables.StoredMedia[]>(ref(Table.StoredMediaDetail));

  let mapped = foundMedia.map(intoMedia);

  let results: (Media | null)[] = [];
  for (let id of ids) {
    results.push(mapped.find((media: Media): boolean => media.id == id) ?? null);
  }

  return results;
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

export async function deleteMedia(this: UserScopedConnection, ids: string[]): Promise<void> {
  let catalogs = from(this.knex, Table.UserCatalog)
    .where("user", this.user)
    .select("catalog");

  await from(this.knex, Table.Media)
    .whereIn(ref(Table.Media, "catalog"), catalogs)
    .whereIn(ref(Table.Media, "id"), ids)
    .delete();
}
