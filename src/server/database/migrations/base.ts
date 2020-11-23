import type Knex from "knex";

import type { TableRecord } from "../types";
import { ref, nameConstraint, columnFor } from "../types";

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

function id(table: Knex.CreateTableBuilder): void {
  table.string("id", 30).notNullable().unique().primary();
}

function foreignId<T extends Table, C extends keyof TableRecord<T>>(
  table: Knex.CreateTableBuilder,
  target: T,
  targetColumn: C,
  command: "CASCADE" | "NO ACTION" | "RESTRICT" = "CASCADE",
): void {
  table.string(columnFor(target), 30)
    .notNullable();
  table.foreign(columnFor(target), `foreign_${target}`)
    .references(ref(target, targetColumn))
    .onDelete(command)
    .onUpdate("CASCADE");
}

export function buildMediaView(knex: Knex): Knex.QueryBuilder {
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
    mappings[field] = knex.raw("COALESCE(?, ?)", [
      knex.ref(`${Table.MediaInfo}.${field}`),
      knex.ref(`CurrentFile.${field}`),
    ]);
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

  return knex(Table.MediaInfo)
    .leftJoin(CurrentFiles, "CurrentFile.media", ref(Table.MediaInfo, "id"))
    .leftJoin(tags, "TagList.media", ref(Table.MediaInfo, "id"))
    .leftJoin(albums, "AlbumList.media", ref(Table.MediaInfo, "id"))
    .leftJoin(people, "PersonList.media", ref(Table.MediaInfo, "id"))
    .whereNot(knex.raw("??", [ref(Table.MediaInfo, "deleted")]))
    .select(mappings);
}

function buildUserCatalogView(knex: Knex): Knex.QueryBuilder {
  let shares = knex(Table.SharedCatalog)
    .select({
      user: ref(Table.SharedCatalog, "user"),
      catalog: ref(Table.SharedCatalog, "catalog"),
      writable: ref(Table.SharedCatalog, "writable"),
    });

  let owns = knex(Table.Catalog)
    .join(Table.Storage, ref(Table.Catalog, "storage"), ref(Table.Storage, "id"))
    .select({
      user: ref(Table.Storage, "owner"),
      catalog: ref(Table.Catalog, "id"),
      writable: knex.raw("true"),
    });

  return owns.union(shares);
}

export async function up(knex: Knex): Promise<void> {
  function addMetadata(table: Knex.CreateTableBuilder): void {
    for (let name of [
      "filename",
      "title",
      "description",
      "label",
      "category",
      "location",
      "city",
      "state",
      "country",
      "make",
      "model",
      "lens",
      "photographer",
      "shutterSpeed",
      "takenZone",
    ]) {
      table.string(name, 200).nullable();
    }

    for (let name of [
      "orientation",
      "iso",
      "rating",
    ]) {
      table.integer(name).nullable();
    }

    for (let name of [
      "longitude",
      "latitude",
      "altitude",
      "aperture",
      "focalLength",
    ]) {
      table.float(name).nullable();
    }

    table.dateTime("taken", { useTz: false }).nullable();
  }

  function nameIndex(table: Table, target: Table, parent: string | null = "parent"): string {
    return knex.raw("CREATE UNIQUE INDEX :index: ON :table: :constraint:", {
      index: table.toLocaleLowerCase(),
      table: table,
      constraint: nameConstraint(knex, target, parent),
    }).toSQL().sql;
  }

  function addFileInfo(table: Knex.CreateTableBuilder): void {
    table.string("fileName", 200).notNullable();
    table.integer("fileSize").notNullable();
    table.string("mimetype", 50).notNullable();
    table.integer("width").notNullable();
    table.integer("height").notNullable();
    table.float("duration").nullable();
    table.float("frameRate").nullable();
    table.float("bitRate").nullable();
  }

  let locationType = knex.raw(`CREATE TYPE ?? AS (
    ?? real,
    ?? real,
    ?? real,
    ?? real
  )`, ["location", "left", "right", "top", "bottom"]);

  await knex.schema.raw(locationType.toString());

  await knex.schema.createTable(Table.User, (table: Knex.CreateTableBuilder): void => {
    table.string("email", 100).notNullable().unique().primary();
    table.string("password", 70);
    table.string("fullname", 200);
    table.boolean("administrator").notNullable();
    table.dateTime("created", { useTz: true }).notNullable();
    table.dateTime("lastLogin", { useTz: true }).nullable();
    table.boolean("verified");
  });

  await knex.schema.createTable(Table.Storage, (table: Knex.CreateTableBuilder): void => {
    id(table);

    table.string("name", 100).notNullable();
    table.string("accessKeyId", 200).notNullable();
    table.string("secretAccessKey", 200).notNullable();
    table.string("bucket", 200).notNullable();
    table.string("region", 20).notNullable();
    table.string("path", 200).nullable();
    table.string("endpoint", 200).nullable();
    table.string("publicUrl", 200).nullable();

    table.string("owner", 30).notNullable();
    table.foreign("owner", `foreign_${Table.User}`)
      .references(ref(Table.User, "email"))
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
  });

  await knex.schema.createTable(Table.Catalog, (table: Knex.CreateTableBuilder): void => {
    id(table);

    table.string("name", 100).notNullable();

    foreignId(table, Table.Storage, "id", "RESTRICT");
  });

  await knex.schema.createTable(Table.Person, (table: Knex.CreateTableBuilder): void => {
    id(table);

    table.string("name", 200).notNullable();

    foreignId(table, Table.Catalog, "id");

    table.unique([columnFor(Table.Catalog), "id"]);
  });

  await knex.schema.raw(
    nameIndex(Table.Person, Table.Catalog, null),
  );

  await knex.schema.createTable(Table.Tag, (table: Knex.CreateTableBuilder): void => {
    id(table);

    table.string("parent", 30).nullable();
    table.string("name", 100).notNullable();

    foreignId(table, Table.Catalog, "id");

    table.unique([columnFor(Table.Catalog), "id"]);
    table.foreign([columnFor(Table.Catalog), "parent"], `foreign_${Table.Tag}`)
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Tag)
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
  });

  await knex.schema.raw(
    nameIndex(Table.Tag, Table.Catalog),
  );

  await knex.schema.createTable(Table.Album, (table: Knex.CreateTableBuilder): void => {
    id(table);

    table.string("parent", 30).nullable();
    table.string("name", 100).notNullable();

    foreignId(table, Table.Catalog, "id");

    table.unique([columnFor(Table.Catalog), "id"]);
    table.foreign([columnFor(Table.Catalog), "parent"], `foreign_${Table.Album}`)
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Album)
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
  });

  await knex.schema.raw(
    nameIndex(Table.Album, Table.Catalog),
  );

  await knex.schema.createTable(Table.MediaInfo, (table: Knex.CreateTableBuilder): void => {
    id(table);

    table.boolean("deleted").notNullable();
    table.dateTime("created", { useTz: true }).notNullable();
    table.dateTime("updated", { useTz: true }).notNullable();

    addMetadata(table);

    foreignId(table, Table.Catalog, "id", "RESTRICT");

    table.unique([columnFor(Table.Catalog), "id"]);
  });

  await knex.schema.createTable(Table.MediaFile, (table: Knex.CreateTableBuilder): void => {
    id(table);

    table.dateTime("uploaded", { useTz: true }).notNullable();
    table.integer("processVersion").notNullable();

    addFileInfo(table);
    addMetadata(table);

    foreignId(table, Table.MediaInfo, "id", "RESTRICT");
  });

  await knex.schema.createTable(Table.AlternateFile, (table: Knex.CreateTableBuilder): void => {
    id(table);

    table.string("type", 20).notNullable();

    addFileInfo(table);

    foreignId(table, Table.MediaFile, "id", "RESTRICT");
  });

  await knex.schema.createTable(Table.SavedSearch, (table: Knex.CreateTableBuilder): void => {
    id(table);

    table.string("name", 100).notNullable();
    table.boolean("shared").notNullable();
    table.json("query").notNullable();

    foreignId(table, Table.Catalog, "id");
  });

  await knex.schema.createTable(Table.SharedCatalog, (table: Knex.CreateTableBuilder): void => {
    table.boolean("writable").notNullable();

    foreignId(table, Table.User, "email");
    foreignId(table, Table.Catalog, "id");

    table.unique([columnFor(Table.User), columnFor(Table.Catalog)]);
  });

  await knex.schema.createTable(Table.MediaAlbum, (table: Knex.CreateTableBuilder): void => {
    table.string(columnFor(Table.Catalog), 30).notNullable();
    table.string(columnFor(Table.MediaInfo), 30).notNullable();
    table.string(columnFor(Table.Album), 30).notNullable();

    table.foreign([
      columnFor(Table.Catalog),
      columnFor(Table.MediaInfo),
    ], `foreign_${Table.MediaInfo}`)
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.MediaInfo)
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.foreign([columnFor(Table.Catalog), columnFor(Table.Album)], `foreign_${Table.Album}`)
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Album)
      .onDelete("CASCADE")
      .onUpdate("CASCADE");

    table.unique([columnFor(Table.MediaInfo), columnFor(Table.Album)], "uniqueAlbumMedia");
  });

  await knex.schema.createTable(Table.MediaTag, (table: Knex.CreateTableBuilder): void => {
    table.string(columnFor(Table.Catalog), 30).notNullable();
    table.string(columnFor(Table.MediaInfo), 30).notNullable();
    table.string(columnFor(Table.Tag), 30).notNullable();

    table.foreign([
      columnFor(Table.Catalog),
      columnFor(Table.MediaInfo),
    ], `foreign_${Table.MediaInfo}`)
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.MediaInfo)
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.foreign([columnFor(Table.Catalog), columnFor(Table.Tag)], `foreign_${Table.Tag}`)
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Tag)
      .onDelete("CASCADE")
      .onUpdate("CASCADE");

    table.unique([columnFor(Table.MediaInfo), columnFor(Table.Tag)], "uniqueTagMedia");
  });

  await knex.schema.createTable(Table.MediaPerson, (table: Knex.CreateTableBuilder): void => {
    table.string(columnFor(Table.Catalog), 30).notNullable();
    table.string(columnFor(Table.MediaInfo), 30).notNullable();
    table.string(columnFor(Table.Person), 30).notNullable();
    table.specificType("location", "location").nullable();

    table.foreign([
      columnFor(Table.Catalog),
      columnFor(Table.MediaInfo),
    ], `foreign_${Table.MediaInfo}`)
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.MediaInfo)
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
    table.foreign([columnFor(Table.Catalog), columnFor(Table.Person)], `foreign_${Table.Person}`)
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Person)
      .onDelete("CASCADE")
      .onUpdate("CASCADE");

    table.unique([columnFor(Table.MediaInfo), columnFor(Table.Person)], "uniquePersonMedia");
  });

  await knex.schema.raw(knex.raw("CREATE VIEW ?? AS ?", [
    Table.MediaView,
    buildMediaView(knex),
  ]).toString());

  await knex.schema.raw(knex.raw("CREATE VIEW ?? AS ?", [
    Table.UserCatalog,
    buildUserCatalogView(knex),
  ]).toString());
}

/**
 * @param {Knex} knex
 * @return {Knex.SchemaBuilder}
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .raw(knex.raw("DROP VIEW ??", [Table.MediaView]).toString())
    .raw(knex.raw("DROP VIEW ??", [Table.UserCatalog]).toString())
    .dropTable(Table.MediaPerson)
    .dropTable(Table.MediaTag)
    .dropTable(Table.MediaAlbum)
    .dropTable(Table.SharedCatalog)
    .dropTable(Table.AlternateFile)
    .dropTable(Table.MediaFile)
    .dropTable(Table.MediaInfo)
    .dropTable(Table.SavedSearch)
    .dropTable(Table.Album)
    .dropTable(Table.Tag)
    .dropTable(Table.Person)
    .dropTable(Table.Catalog)
    .dropTable(Table.User);
}
