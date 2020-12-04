import type { default as Knex, AlterTableBuilder } from "knex";

import { ref, Table } from "../types";
import { buildUserCatalogView } from "./base";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(knex.raw("DROP VIEW IF EXISTS ??", ["UserCatalog"]).toString());

  await knex.schema.raw(knex.raw("CREATE MATERIALIZED VIEW ?? AS ?", [
    Table.UserCatalog,
    buildUserCatalogView(knex),
  ]).toString());

  await knex.schema.alterTable(Table.UserCatalog, (table: AlterTableBuilder) => {
    table.index("user", "idx_UserCatalog_user");
    table.index("catalog", "idx_UserCatalog_catalog");
  });

  let fn = "refreshUserCatalogs()";
  await knex.schema.raw(
    knex.raw(
      `CREATE FUNCTION ${fn} RETURNS TRIGGER AS $fn$
          BEGIN
            REFRESH MATERIALIZED VIEW ??;
            RETURN NULL;
          END; $fn$ LANGUAGE plpgsql;`,
      [
        Table.UserCatalog,
      ],
    ).toString(),
  );

  await knex.schema.raw(
    knex.raw(`CREATE TRIGGER ??
        AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE
        ON ?? EXECUTE FUNCTION ${fn}`, [
      "refreshUserCatalogsFromSharedCatalogs",
      Table.SharedCatalog,
    ]).toString(),
  );

  await knex.schema.raw(
    knex.raw(`CREATE TRIGGER ??
        AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE
        ON ?? EXECUTE FUNCTION ${fn}`, [
      "refreshUserCatalogsFromCatalogs",
      Table.Catalog,
    ]).toString(),
  );

  /* eslint-disable @typescript-eslint/naming-convention */
  let indexNames = {
    album: "unique_Album_catalog_parent_name",
    person: "unique_Person_catalog_name",
    tag: "unique_Tag_catalog_parent_name",
    mediainfo_id_unique: "unique_MediaInfo_id",
    mediainfo_catalog_id_unique: "unique_MediaInfo_catalog_id",
    album_catalog_id_unique: "unique_Album_catalog_id",
    album_id_unique: "unique_Album_id",
    person_catalog_id_unique: "unique_Person_catalog_id",
    person_id_unique: "unique_Person_id",
    tag_catalog_id_unique: "unique_Tag_catalog_id",
    tag_id_unique: "unique_Tag_id",
    alternatefile_id_unique: "unique_AlternateFile_id",
    catalog_id_unique: "unique_Catalog_id",
    mediafile_id_unique: "unique_MediaFile_id",
    savedsearch_id_unique: "unique_SavedSearch_id",
    storage_id_unique: "unique_Storage_id",
    user_email_unique: "unique_User_email",
    shared_catalog_user_catalog_unique: "unique_Shared_Catalog_user_catalog",

    uniqueAlbumMedia: "unique_Media_Album_media_album",
    uniquePersonMedia: "unique_Media_Person_media_person",
    uniqueTagMedia: "unique_Media_Tag_media_tag",
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  for (let [oldName, newName] of Object.entries(indexNames)) {
    await knex.schema.raw(
      knex.raw("ALTER INDEX ?? RENAME TO ??", [oldName, newName]).toString(),
    );
  }

  await knex.schema.alterTable(Table.AlternateFile, (table: AlterTableBuilder) => {
    table.index(["mediaFile", "type"], "idx_AlternateFile_mediaFile_type");
  });

  await knex.schema.alterTable(Table.MediaFile, (table: AlterTableBuilder) => {
    table.index("media", "idx_MediaFile_media");
  });

  await knex.schema.alterTable(Table.MediaInfo, (table: AlterTableBuilder) => {
    table.string("mediaFile", 30).nullable();
    table.unique(["mediaFile"], "unique_MediaInfo_mediaFile");
    table.foreign("mediaFile", "foreign_MediaFile")
      .references(ref(Table.MediaFile, "id"))
      .onDelete("SET NULL")
      .onUpdate("CASCADE");
    table.index(["catalog"], "idx_MediaInfo_catalog");
  });

  let mediaFiles = knex.from(Table.MediaFile)
    .where(ref(Table.MediaFile, "media"), knex.ref(ref(Table.MediaInfo, "id")))
    .orderBy([
      { column: ref(Table.MediaFile, "media"), order: "asc" },
      { column: ref(Table.MediaFile, "uploaded"), order: "desc" },
      { column: ref(Table.MediaFile, "processVersion"), order: "desc" },
    ])
    .distinctOn(ref(Table.MediaFile, "media"))
    .select(ref(Table.MediaFile, "id"));

  await knex.table(Table.MediaInfo)
    .update({
      mediaFile: mediaFiles,
    });

  await knex.schema.raw(knex.raw("DROP VIEW ??", ["MediaView"]).toString());
}

export async function down(): Promise<void> {
  // no-op
}
