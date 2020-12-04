import type { default as Knex, QueryBuilder } from "knex";

import type { ObjectModel } from "../../model";
import { MetadataColumns } from "../../model";
import type { Overwrite } from "../../utils";
import type { Tables } from "./types";
import { ref, Table } from "./types";

export type MediaViewFile = Overwrite<ObjectModel.MediaFile, {
  uploaded: string;
  fileName: string;
}>;

export type MediaView = Omit<Tables.MediaInfo, "mediaFile" | "deleted"> & {
  file: null | MediaViewFile;
};

export function mediaView(knex: Knex): QueryBuilder<MediaView, MediaView[]> {
  let mappings = {};
  for (let field of Object.keys(MetadataColumns)) {
    if (field == "takenZone") {
      mappings[field] = knex.raw("CASE WHEN ? IS NULL THEN ? ELSE ? END", [
        knex.ref(ref(Table.MediaInfo, "taken")),
        knex.ref(ref(Table.MediaFile, "takenZone")),
        knex.ref(ref(Table.MediaInfo, "takenZone")),
      ]);
    } else {
      mappings[field] = knex.raw("COALESCE(?, ?)", [
        knex.ref(`${Table.MediaInfo}.${field}`),
        knex.ref(`${Table.MediaFile}.${field}`),
      ]);
    }
  }

  return knex.from(knex.from(Table.MediaInfo)
    .leftJoin(Table.MediaFile, ref(Table.MediaFile, "id"), ref(Table.MediaInfo, "mediaFile"))
    .whereRaw("NOT ??", [ref(Table.MediaInfo, "deleted")])
    .select({
      id: ref(Table.MediaInfo, "id"),
      catalog: ref(Table.MediaInfo, "catalog"),
      created: ref(Table.MediaInfo, "created"),
      updated: knex.raw("GREATEST(?, ?)", [
        knex.ref(ref(Table.MediaInfo, "updated")),
        knex.ref(ref(Table.MediaFile, "uploaded")),
      ]),
      file: knex.raw(`CASE
      WHEN ?? IS NULL THEN NULL
      ELSE (SELECT to_json(_) FROM (SELECT
        ??,
        ??,
        ??,
        ??,
        ??,
        ??,
        ??,
        ??,
        ??,
        ??,
        ??
      ) AS _)
      END`, [
        ref(Table.MediaFile, "id"),
        ref(Table.MediaFile, "id"),
        ref(Table.MediaFile, "processVersion"),
        ref(Table.MediaFile, "fileName"),
        ref(Table.MediaFile, "fileSize"),
        ref(Table.MediaFile, "uploaded"),
        ref(Table.MediaFile, "mimetype"),
        ref(Table.MediaFile, "width"),
        ref(Table.MediaFile, "height"),
        ref(Table.MediaFile, "duration"),
        ref(Table.MediaFile, "frameRate"),
        ref(Table.MediaFile, "bitRate"),
      ]),
      ...mappings,
    })
    .as(Table.MediaView));
}
