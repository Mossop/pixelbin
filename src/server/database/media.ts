import type { QueryBuilder } from "knex";

import type { ObjectModel, AlternateFileType } from "../../model";
import { Level, now } from "../../utils";
import type { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { mediaId } from "./id";
import type { MediaView } from "./mediaview";
import { mediaView } from "./mediaview";
import { from, update, insert } from "./queries";
import type { Tables } from "./types";
import {
  applyTimeZoneFields,
  Table,
  ref,
  intoDBTypes,
  buildTimeZoneFields,
} from "./types";
import { ensureUserTransaction, deleteFields } from "./utils";

export const createMedia = ensureUserTransaction(async function createMedia(
  this: UserScopedConnection,
  catalog: MediaView["catalog"],
  data: Omit<Tables.MediaInfo, "id" | "catalog" | "created" | "updated" | "deleted" | "mediaFile">,
): Promise<MediaView> {
  await this.checkWrite(Table.Catalog, [catalog]);

  let current = now();
  let id = await mediaId();

  await insert(this.knex, Table.MediaInfo, intoDBTypes({
    ...buildTimeZoneFields(data),
    id,
    catalog,
    created: current,
    updated: current,
    deleted: false,
    mediaFile: null,
  }));

  let results = await this.getMedia([id]);
  if (!results[0]) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Media record.");
  }

  return results[0];
});

export const editMedia = ensureUserTransaction(async function editMedia(
  this: UserScopedConnection,
  id: MediaView["id"],
  data: Partial<Omit<Tables.MediaInfo, "id" | "catalog" | "created" | "updated" | "deleted">>,
): Promise<MediaView> {
  await this.checkWrite(Table.MediaInfo, [id]);

  let updateData = deleteFields(data, [
    "id",
    "catalog",
    "created",
    "mediaFile",
  ]);

  await update(
    Table.MediaInfo,
    this.knex.where("id", id),
    intoDBTypes({
      ...buildTimeZoneFields(updateData),
      updated: now(),
      deleted: false,
    }),
  );

  let [edited] = await this.getMedia([id]);
  if (!edited) {
    throw new DatabaseError(
      DatabaseErrorCode.UnknownError,
      "Failed to find edited Media record.",
    );
  }

  return edited;
});

export async function getMedia(
  this: UserScopedConnection,
  ids: string[],
): Promise<(MediaView | null)[]> {
  if (ids.length == 0) {
    return [];
  }

  return this.logger.child("getMedia").timeLonger(async (): Promise<(MediaView | null)[]> => {
    let foundMedia = await mediaView(this.knex)
      .whereIn(ref(Table.MediaView, "catalog"), this.catalogs())
      .whereIn(ref(Table.MediaView, "id"), ids)
      .select(ref(Table.MediaView));

    let mediaMap: Map<string, Tables.MediaView> = new Map(foundMedia.map(
      (media: Tables.MediaView): [string, Tables.MediaView] =>
        [media.id, applyTimeZoneFields(media)],
    ));

    return ids.map((id: string): MediaView | null => mediaMap.get(id) ?? null);
  }, Level.Trace, 100, "Fetched media.");
}

export type AlternateInfo = Tables.AlternateFile & {
  media: string;
  catalog: string;
};

export async function getMediaAlternates(
  this: UserScopedConnection,
  media: string,
  mediaFile: string,
  type: AlternateFileType,
  mimetype: string,
): Promise<AlternateInfo[]> {
  return from(this.knex, Table.AlternateFile)
    .join(Table.MediaFile, ref(Table.MediaFile, "id"), ref(Table.AlternateFile, "mediaFile"))
    .join(Table.MediaInfo, ref(Table.MediaInfo, "id"), ref(Table.MediaFile, "media"))
    .whereIn(ref(Table.MediaInfo, "catalog"), this.catalogs())
    .andWhere({
      [ref(Table.MediaInfo, "id")]: media,
      [ref(Table.MediaFile, "id")]: mediaFile,
      [ref(Table.AlternateFile, "type")]: type,
    })
    .andWhere((qb: QueryBuilder) => {
      void qb.where(ref(Table.AlternateFile, "mimetype"), mimetype)
        .orWhere(ref(Table.AlternateFile, "mimetype"), "LIKE", `${mimetype};%`);
    })
    .select<AlternateInfo[]>(ref(Table.AlternateFile), {
      media: ref(Table.MediaInfo, "id"),
      catalog: ref(Table.MediaInfo, "catalog"),
    });
}

export type MediaFileInfo = ObjectModel.MediaFile & {
  media: string;
  catalog: string;
  fileName: string;
};

export async function getMediaFile(
  this: UserScopedConnection,
  media: string,
): Promise<MediaFileInfo | null> {
  let results = await from(this.knex, Table.MediaFile)
    .join(Table.MediaInfo, ref(Table.MediaInfo, "mediaFile"), ref(Table.MediaFile, "id"))
    .whereIn(ref(Table.MediaInfo, "catalog"), this.catalogs())
    .andWhere({
      [ref(Table.MediaInfo, "id")]: media,
    })
    .select<MediaFileInfo[]>({
      id: ref(Table.MediaFile, "id"),
      catalog: ref(Table.MediaInfo, "catalog"),
      media: ref(Table.MediaFile, "media"),
      fileName: ref(Table.MediaFile, "fileName"),
      uploaded: ref(Table.MediaFile, "uploaded"),
      processVersion: ref(Table.MediaFile, "processVersion"),
      fileSize: ref(Table.MediaFile, "fileSize"),
      mimetype: ref(Table.MediaFile, "mimetype"),
      width: ref(Table.MediaFile, "width"),
      height: ref(Table.MediaFile, "height"),
      duration: ref(Table.MediaFile, "duration"),
      frameRate: ref(Table.MediaFile, "frameRate"),
      bitRate: ref(Table.MediaFile, "bitRate"),
    });

  if (results.length != 1) {
    return null;
  }

  return results[0];
}

export const listAlternateFiles = ensureUserTransaction(async function listAlternateFiles(
  this: UserScopedConnection,
  media: MediaView["id"],
  type: AlternateFileType,
): Promise<Tables.AlternateFile[]> {
  await this.checkRead(Table.MediaInfo, [media]);

  return from(this.knex, Table.AlternateFile)
    .join(
      Table.MediaFile,
      ref(Table.AlternateFile, "mediaFile"),
      ref(Table.MediaFile, "id"),
    )
    .join(
      Table.MediaInfo,
      ref(Table.MediaFile, "id"),
      ref(Table.MediaInfo, "mediaFile"),
    )
    .where(ref(Table.AlternateFile, "type"), type)
    .where(ref(Table.MediaInfo, "id"), media)
    .select(ref(Table.AlternateFile));
});

export const deleteMedia = ensureUserTransaction(async function deleteMedia(
  this: UserScopedConnection,
  ids: string[],
): Promise<void> {
  await this.checkWrite(Table.MediaInfo, ids);

  await update(
    Table.MediaInfo,
    this.knex.whereIn("id", ids),
    { deleted: true },
  );
});
