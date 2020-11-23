import type { default as Knex, Migration } from "knex";

import { ref } from "../types";
import { buildMediaView } from "./base";

export const takenZone: Migration = {
  up: async function(knex: Knex): Promise<void> {
    // Fixed for this migration.
    enum Table {
      User = "User",
      Storage = "Storage",
      Catalog = "Catalog",
      Album = "Album",
      Tag = "Tag",
      Person = "Person",
      MediaInfo = "MediaInfo",
      MediaFile = "MediaFile",
      AlternateFile = "AlternateFile",
      SavedSearch = "SavedSearch",

      SharedCatalog = "Shared_Catalog",
      MediaAlbum = "Media_Album",
      MediaTag = "Media_Tag",
      MediaPerson = "Media_Person",

      // Not real tables.
      MediaView = "MediaView",
      UserCatalog = "UserCatalog",
    }

    // Fixed for this migration.
    const MetadataColumns = [
      "title",
      "filename",
      "description",
      "category",
      "label",
      "location",
      "city",
      "state",
      "country",
      "make",
      "model",
      "lens",
      "photographer",
      "shutterSpeed",
      "longitude",
      "latitude",
      "altitude",
      "orientation",
      "aperture",
      "iso",
      "focalLength",
      "rating",
      "taken",
      "takenZone",
    ];

    let mappings = {
      id: ref(Table.MediaInfo, "id"),
      catalog: ref(Table.MediaInfo, "catalog"),
      created: ref(Table.MediaInfo, "created"),
      updated: knex.raw("GREATEST(?, ?)", [
        knex.ref(`${Table.MediaInfo}.updated`),
        knex.ref("CurrentFile.uploaded"),
      ]),
      file: knex.raw(`CASE
      WHEN ?? IS NULL THEN NULL
      ELSE (SELECT row_to_json(_) FROM (SELECT
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
        "CurrentFile.id",
        "CurrentFile.id",
        "CurrentFile.processVersion",
        "CurrentFile.fileName",
        "CurrentFile.fileSize",
        "CurrentFile.uploaded",
        "CurrentFile.mimetype",
        "CurrentFile.width",
        "CurrentFile.height",
        "CurrentFile.duration",
        "CurrentFile.frameRate",
        "CurrentFile.bitRate",
      ]),
      albums: knex.raw("COALESCE(??, '[]'::json)", ["AlbumList.albums"]),
      people: knex.raw("COALESCE(??, '[]'::json)", ["PersonList.people"]),
      tags: knex.raw("COALESCE(??, '[]'::json)", ["TagList.tags"]),
    };

    for (let field of MetadataColumns) {
      if (field == "takenZone") {
        mappings[field] = knex.raw("CASE WHEN ? IS NULL THEN ? ELSE ? END", [
          knex.ref(`${Table.MediaInfo}.taken`),
          knex.ref(`CurrentFile.${field}`),
          knex.ref(`${Table.MediaInfo}.${field}`),
        ]);
      } else {
        mappings[field] = knex.raw("COALESCE(?, ?)", [
          knex.ref(`${Table.MediaInfo}.${field}`),
          knex.ref(`CurrentFile.${field}`),
        ]);
      }
    }

    let CurrentFiles = knex(Table.MediaFile)
      .orderBy([
        { column: ref(Table.MediaFile, "media"), order: "asc" },
        { column: ref(Table.MediaFile, "uploaded"), order: "desc" },
      ])
      .distinctOn(ref(Table.MediaFile, "media"))
      .as("CurrentFile");

    let tags = knex(Table.MediaTag)
      .groupBy(ref(Table.MediaTag, "media"))
      .select({
        media: ref(Table.MediaTag, "media"),
        tags: knex.raw(
          "json_agg((SELECT row_to_json(_) AS ?? FROM (SELECT ?? AS ??) AS _))",
          ["id", ref(Table.MediaTag, "tag"), "tag"],
        ),
      })
      .as("TagList");

    let albums = knex(Table.MediaAlbum)
      .groupBy(ref(Table.MediaAlbum, "media"))
      .select({
        media: ref(Table.MediaAlbum, "media"),
        albums: knex.raw(
          "json_agg((SELECT row_to_json(_) AS ?? FROM (SELECT ?? AS ??) AS _))",
          ["id", ref(Table.MediaAlbum, "album"), "album"],
        ),
      })
      .as("AlbumList");

    let people = knex(Table.MediaPerson)
      .groupBy(ref(Table.MediaPerson, "media"))
      .select({
        media: ref(Table.MediaPerson, "media"),
        people: knex.raw(
          "json_agg((SELECT row_to_json(_) AS ?? FROM (SELECT ?? AS ??, ?? AS ??) AS _))",
          [
            "id",
            ref(Table.MediaPerson, "person"),
            "person",
            ref(Table.MediaPerson, "location"),
            "location",
          ],
        ),
      })
      .as("PersonList");

    let viewSchema = knex(Table.MediaInfo)
      .leftJoin(CurrentFiles, "CurrentFile.media", ref(Table.MediaInfo, "id"))
      .leftJoin(tags, "TagList.media", ref(Table.MediaInfo, "id"))
      .leftJoin(albums, "AlbumList.media", ref(Table.MediaInfo, "id"))
      .leftJoin(people, "PersonList.media", ref(Table.MediaInfo, "id"))
      .whereNot(knex.raw("??", [ref(Table.MediaInfo, "deleted")]))
      .select(mappings);

    await knex.schema.raw(knex.raw("CREATE OR REPLACE VIEW ?? AS ?", [
      Table.MediaView,
      viewSchema,
    ]).toString());
  },

  down: async function(knex: Knex): Promise<void> {
    await knex.schema.raw(knex.raw("CREATE OR REPLACE VIEW ?? AS ?", [
      "MediaView",
      buildMediaView(knex),
    ]).toString());
  },
};

export const jsonb: Migration = {
  up: async function(knex: Knex): Promise<void> {
    // Fixed for this migration.
    enum Table {
      User = "User",
      Storage = "Storage",
      Catalog = "Catalog",
      Album = "Album",
      Tag = "Tag",
      Person = "Person",
      MediaInfo = "MediaInfo",
      MediaFile = "MediaFile",
      AlternateFile = "AlternateFile",
      SavedSearch = "SavedSearch",

      SharedCatalog = "Shared_Catalog",
      MediaAlbum = "Media_Album",
      MediaTag = "Media_Tag",
      MediaPerson = "Media_Person",

      // Not real tables.
      MediaView = "MediaView",
      UserCatalog = "UserCatalog",
    }

    // Fixed for this migration.
    const MetadataColumns = [
      "title",
      "filename",
      "description",
      "category",
      "label",
      "location",
      "city",
      "state",
      "country",
      "make",
      "model",
      "lens",
      "photographer",
      "shutterSpeed",
      "longitude",
      "latitude",
      "altitude",
      "orientation",
      "aperture",
      "iso",
      "focalLength",
      "rating",
      "taken",
      "takenZone",
    ];

    let mappings = {
      id: ref(Table.MediaInfo, "id"),
      catalog: ref(Table.MediaInfo, "catalog"),
      created: ref(Table.MediaInfo, "created"),
      updated: knex.raw("GREATEST(?, ?)", [
        knex.ref(`${Table.MediaInfo}.updated`),
        knex.ref("CurrentFile.uploaded"),
      ]),
      file: knex.raw(`CASE
      WHEN ?? IS NULL THEN NULL
      ELSE (SELECT to_jsonb(_) FROM (SELECT
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
        "CurrentFile.id",
        "CurrentFile.id",
        "CurrentFile.processVersion",
        "CurrentFile.fileName",
        "CurrentFile.fileSize",
        "CurrentFile.uploaded",
        "CurrentFile.mimetype",
        "CurrentFile.width",
        "CurrentFile.height",
        "CurrentFile.duration",
        "CurrentFile.frameRate",
        "CurrentFile.bitRate",
      ]),
      albums: knex.raw("COALESCE(??, '[]'::jsonb)", ["AlbumList.albums"]),
      people: knex.raw("COALESCE(??, '[]'::jsonb)", ["PersonList.people"]),
      tags: knex.raw("COALESCE(??, '[]'::jsonb)", ["TagList.tags"]),
    };

    for (let field of MetadataColumns) {
      if (field == "takenZone") {
        mappings[field] = knex.raw("CASE WHEN ? IS NULL THEN ? ELSE ? END", [
          knex.ref(`${Table.MediaInfo}.taken`),
          knex.ref(`CurrentFile.${field}`),
          knex.ref(`${Table.MediaInfo}.${field}`),
        ]);
      } else {
        mappings[field] = knex.raw("COALESCE(?, ?)", [
          knex.ref(`${Table.MediaInfo}.${field}`),
          knex.ref(`CurrentFile.${field}`),
        ]);
      }
    }

    let CurrentFiles = knex(Table.MediaFile)
      .orderBy([
        { column: ref(Table.MediaFile, "media"), order: "asc" },
        { column: ref(Table.MediaFile, "uploaded"), order: "desc" },
      ])
      .distinctOn(ref(Table.MediaFile, "media"))
      .as("CurrentFile");

    let tags = knex(Table.MediaTag)
      .groupBy(ref(Table.MediaTag, "media"))
      .select({
        media: ref(Table.MediaTag, "media"),
        tags: knex.raw(
          "jsonb_agg((SELECT to_jsonb(_) AS ?? FROM (SELECT ?? AS ??) AS _))",
          ["id", ref(Table.MediaTag, "tag"), "tag"],
        ),
      })
      .as("TagList");

    let albums = knex(Table.MediaAlbum)
      .groupBy(ref(Table.MediaAlbum, "media"))
      .select({
        media: ref(Table.MediaAlbum, "media"),
        albums: knex.raw(
          "jsonb_agg((SELECT to_jsonb(_) AS ?? FROM (SELECT ?? AS ??) AS _))",
          ["id", ref(Table.MediaAlbum, "album"), "album"],
        ),
      })
      .as("AlbumList");

    let people = knex(Table.MediaPerson)
      .groupBy(ref(Table.MediaPerson, "media"))
      .select({
        media: ref(Table.MediaPerson, "media"),
        people: knex.raw(
          "jsonb_agg((SELECT to_jsonb(_) AS ?? FROM (SELECT ?? AS ??, ?? AS ??) AS _))",
          [
            "id",
            ref(Table.MediaPerson, "person"),
            "person",
            ref(Table.MediaPerson, "location"),
            "location",
          ],
        ),
      })
      .as("PersonList");

    let viewSchema = knex(Table.MediaInfo)
      .leftJoin(CurrentFiles, "CurrentFile.media", ref(Table.MediaInfo, "id"))
      .leftJoin(tags, "TagList.media", ref(Table.MediaInfo, "id"))
      .leftJoin(albums, "AlbumList.media", ref(Table.MediaInfo, "id"))
      .leftJoin(people, "PersonList.media", ref(Table.MediaInfo, "id"))
      .whereNot(knex.raw("??", [ref(Table.MediaInfo, "deleted")]))
      .select(mappings);

    await knex.schema.raw(knex.raw("DROP VIEW IF EXISTS ??", [
      Table.MediaView,
    ]).toString());

    await knex.schema.raw(knex.raw("CREATE OR REPLACE VIEW ?? AS ?", [
      Table.MediaView,
      viewSchema,
    ]).toString());
  },

  down: async function(knex: Knex): Promise<void> {
    await knex.schema.raw(knex.raw("DROP VIEW IF EXISTS ??", [
      "MediaView",
    ]).toString());

    return takenZone.up(knex);
  },
};
