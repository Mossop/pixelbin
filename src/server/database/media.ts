import { AlternateFileType } from "../../model";
import { AllNull, now } from "../../utils";
import { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { mediaId } from "./id";
import { from, update, insert } from "./queries";
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
import { filterColumns, ensureUserTransaction, asTable } from "./utils";

export function intoMedia(item: Tables.StoredMediaDetail & { deleted?: boolean }): Media {
  let forApi = applyTimeZoneFields(intoAPITypes(item));
  delete forApi.deleted;

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

export const createMedia = ensureUserTransaction(async function createMedia(
  this: UserScopedConnection,
  catalog: Tables.Media["catalog"],
  data: Omit<Tables.Media, "id" | "catalog" | "created" | "updated" | "deleted">,
): Promise<UnprocessedMedia> {
  await this.checkWrite(Table.Catalog, [catalog]);

  let current = now();
  let id = await mediaId();

  await insert(this.knex, Table.Media, intoDBTypes({
    ...buildTimeZoneFields(filterColumns(Table.Media, data)),
    id,
    catalog,
    created: current,
    updated: current,
    deleted: false,
  })).returning("id");

  let results = await this.getMedia([id]);
  if (!results[0]) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Media record.");
  }

  return results[0];
});

export const editMedia = ensureUserTransaction(async function editMedia(
  this: UserScopedConnection,
  id: Tables.Media["id"],
  data: Partial<Omit<Tables.Media, "id" | "catalog" | "created" | "updated" | "deleted">>,
): Promise<Media> {
  await this.checkWrite(Table.Media, [id]);

  await update(
    Table.Media,
    this.knex.where("id", id),
    intoDBTypes({
      ...buildTimeZoneFields(filterColumns(Table.Media, data)),
      updated: now(),
      deleted: false,
    }),
  );

  let edited = (await this.getMedia([id]))[0];
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
): Promise<(Media | null)[]> {
  if (ids.length == 0) {
    return [];
  }

  let visible = from(this.knex, Table.StoredMediaDetail)
    .whereIn(ref(Table.StoredMediaDetail, "catalog"), this.catalogs());

  type Joined = Tables.StoredMediaDetail | AllNull<Tables.StoredMediaDetail>;

  let foundMedia = await this.knex(asTable(this.knex, ids, "Ids", "id", "index"))
    .leftJoin(visible.as("Visible"), "Visible.id", "Ids.id")
    .orderBy("Ids.index")
    .select<Joined[]>("Visible.*");

  return foundMedia.map((record: Joined) => {
    if (record.id == null) {
      return null;
    }
    return intoMedia(record);
  });
}

export const listAlternateFiles = ensureUserTransaction(async function listAlternateFiles(
  this: UserScopedConnection,
  id: string,
  type: AlternateFileType,
): Promise<Tables.AlternateFile[]> {
  await this.checkRead(Table.Media, [id]);

  return from(this.knex, Table.AlternateFile)
    .join(Table.Original, ref(Table.Original, "id"), ref(Table.AlternateFile, "original"))
    .join(Table.Media, ref(Table.Original, "media"), ref(Table.Media, "id"))
    .where(ref(Table.AlternateFile, "type"), type)
    .where(ref(Table.Media, "id"), id)
    .select(ref(Table.AlternateFile));
});

export const deleteMedia = ensureUserTransaction(async function deleteMedia(
  this: UserScopedConnection,
  ids: string[],
): Promise<void> {
  await this.checkWrite(Table.Media, ids);

  await update(
    Table.Media,
    this.knex.whereIn("id", ids),
    { deleted: true },
  );
});
