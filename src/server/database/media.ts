import type { AlternateFileType } from "../../model";
import type { AllNull } from "../../utils";
import { now } from "../../utils";
import type { UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { mediaId } from "./id";
import { from, update, insert } from "./queries";
import type { Tables } from "./types";
import {
  Table,
  ref,
  intoDBTypes,
  buildTimeZoneFields,
  applyTimeZoneFields,
} from "./types";
import { ensureUserTransaction, asTable, deleteFields } from "./utils";

export const createMedia = ensureUserTransaction(async function createMedia(
  this: UserScopedConnection,
  catalog: Tables.MediaView["catalog"],
  data: Omit<Tables.MediaInfo, "id" | "catalog" | "created" | "updated" | "deleted">,
): Promise<Tables.MediaView> {
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
  })).returning("id");

  let results = await this.getMedia([id]);
  if (!results[0]) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Failed to insert Media record.");
  }

  return results[0];
});

export const editMedia = ensureUserTransaction(async function editMedia(
  this: UserScopedConnection,
  id: Tables.MediaView["id"],
  data: Partial<Omit<Tables.MediaInfo, "id" | "catalog" | "created" | "updated" | "deleted">>,
): Promise<Tables.MediaView> {
  await this.checkWrite(Table.MediaInfo, [id]);

  let updateData = deleteFields(data, [
    "id",
    "catalog",
    "created",
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
  ids: Tables.MediaView["id"][],
): Promise<(Tables.MediaView | null)[]> {
  if (ids.length == 0) {
    return [];
  }

  let visible = from(this.knex, Table.MediaView)
    .whereIn(ref(Table.MediaView, "catalog"), this.catalogs());

  type Joined = Tables.MediaView | AllNull<Tables.MediaView>;

  let foundMedia = await this.knex(asTable(this.knex, ids, "Ids", "id", "index"))
    .leftJoin(visible.as("Visible"), "Visible.id", "Ids.id")
    .orderBy("Ids.index")
    .select<Joined[]>("Visible.*");

  return foundMedia.map((record: Joined): Tables.MediaView | null => {
    if (record.id == null) {
      return null;
    }
    return applyTimeZoneFields(record);
  });
}

export const listAlternateFiles = ensureUserTransaction(async function listAlternateFiles(
  this: UserScopedConnection,
  media: Tables.MediaView["id"],
  type: AlternateFileType,
): Promise<Tables.AlternateFile[]> {
  await this.checkRead(Table.MediaInfo, [media]);

  return from(this.knex, Table.AlternateFile)
    .join(
      Table.MediaView,
      ref(Table.AlternateFile, "mediaFile"),
      this.knex.raw("??->>'id'", [ref(Table.MediaView, "file")]),
    )
    .where(ref(Table.AlternateFile, "type"), type)
    .where(ref(Table.MediaView, "id"), media)
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
