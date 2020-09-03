import Knex from "knex";

import { ObjectModel } from "../../../model";
import { Table, ref, TableRecord, nameConstraint, columnFor } from "../types";

function id(table: Knex.CreateTableBuilder): void {
  table.string("id", 30).notNullable().unique().primary();
}

function foreignId<T extends Table, C extends keyof TableRecord<T>>(
  table: Knex.CreateTableBuilder,
  target: T,
  targetColumn: C,
  nullable: boolean = false,
  column: string = columnFor(target),
): void {
  let col = table.string(column, 30);
  if (!nullable) {
    col.notNullable();
  } else {
    col.nullable();
  }
  table.foreign(column, `foreign_${target}`)
    .references(ref(target, targetColumn))
    .onDelete("CASCADE");
}

function buildMediaView(knex: Knex): Knex.QueryBuilder {
  let mappings = {
    id: ref(Table.Media, "id"),
    catalog: ref(Table.Media, "catalog"),
    created: ref(Table.Media, "created"),
    uploaded: "CurrentOriginal.uploaded",
    mimetype: "CurrentOriginal.mimetype",
    width: "CurrentOriginal.width",
    height: "CurrentOriginal.height",
    duration: "CurrentOriginal.duration",
    fileSize: "CurrentOriginal.fileSize",
    frameRate: "CurrentOriginal.frameRate",
    bitRate: "CurrentOriginal.bitRate",
  };

  for (let field of ObjectModel.metadataColumns) {
    mappings[field] = knex.raw("COALESCE(?, ?)", [
      knex.ref(ref(Table.Media, field)),
      knex.ref(`CurrentOriginal.${field}`),
    ]);
  }

  let currentOriginals = knex(Table.Original)
    .orderBy([
      { column: ref(Table.Original, "media"), order: "asc" },
      { column: ref(Table.Original, "uploaded"), order: "desc" },
    ])
    .distinctOn(ref(Table.Original, "media"))
    .as("CurrentOriginal");

  return knex(Table.Media)
    .leftJoin(currentOriginals, "CurrentOriginal.media", ref(Table.Media, "id"))
    .select(mappings);
}

function buildMediaDetailView(knex: Knex): Knex.QueryBuilder {
  let tags = knex(Table.MediaTag)
    .join((builder: Knex.QueryBuilder): void => {
      void builder.from(Table.Tag)
        .select({
          id: ref(Table.Tag, "id"),
          tag: knex.raw(`row_to_json("${Table.Tag}")`),
        })
        .as("TagJson");
    }, ref(Table.MediaTag, "tag"), "TagJson.id")
    .groupBy(ref(Table.MediaTag, "media"))
    .select({
      media: ref(Table.MediaTag, "media"),
      tags: knex.raw("json_agg(?)", [
        knex.ref("TagJson.tag"),
      ]),
    })
    .as("TagList");

  let albums = knex(Table.MediaAlbum)
    .join((builder: Knex.QueryBuilder): void => {
      void builder.from(Table.Album)
        .select({
          id: ref(Table.Album, "id"),
          album: knex.raw(`row_to_json("${Table.Album}")`),
        })
        .as("AlbumJson");
    }, ref(Table.MediaAlbum, "album"), "AlbumJson.id")
    .groupBy(ref(Table.MediaAlbum, "media"))
    .select({
      media: ref(Table.MediaAlbum, "media"),
      albums: knex.raw("json_agg(?)", [
        knex.ref("AlbumJson.album"),
      ]),
    })
    .as("AlbumList");

  let people = knex(Table.MediaPerson)
    .join((builder: Knex.QueryBuilder): void => {
      void builder.from(Table.Person)
        .select({
          id: ref(Table.Person, "id"),
          person: knex.raw(`row_to_json("${Table.Person}")`),
        })
        .as("PersonJson");
    }, ref(Table.MediaPerson, "person"), "PersonJson.id")
    .groupBy(ref(Table.MediaPerson, "media"))
    .select({
      media: ref(Table.MediaPerson, "media"),
      people: knex.raw("json_agg(?)", [
        knex.ref("PersonJson.person"),
      ]),
    })
    .as("PersonList");

  return knex(Table.StoredMedia)
    .leftJoin(tags, "TagList.media", ref(Table.StoredMedia, "id"))
    .leftJoin(albums, "AlbumList.media", ref(Table.StoredMedia, "id"))
    .leftJoin(people, "PersonList.media", ref(Table.StoredMedia, "id"))
    .select(ref(Table.StoredMedia))
    .select({
      tags: knex.raw("COALESCE(?, '[]'::json)", [
        knex.ref("TagList.tags"),
      ]),
      albums: knex.raw("COALESCE(?, '[]'::json)", [
        knex.ref("AlbumList.albums"),
      ]),
      people: knex.raw("COALESCE(?, '[]'::json)", [
        knex.ref("PersonList.people"),
      ]),
    });
}

exports.up = function(knex: Knex): Knex.SchemaBuilder {
  function addMetadata(table: Knex.CreateTableBuilder): void {
    for (let name of [
      "filename",
      "title",
      "location",
      "city",
      "state",
      "country",
      "make",
      "model",
      "lens",
      "photographer",
      "timeZone",
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
      "exposure",
      "focalLength",
    ]) {
      table.float(name).nullable();
    }

    table.dateTime("taken", { useTz: true }).nullable();
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

  return knex.schema
    .createTable(Table.User, (table: Knex.CreateTableBuilder): void => {
      table.string("email", 100).notNullable().unique().primary();
      table.string("password", 70);
      table.string("fullname", 200);
      table.dateTime("created", { useTz: true }).notNullable();
      table.dateTime("lastLogin", { useTz: true }).nullable();
      table.boolean("verified");
    })
    .createTable(Table.Storage, (table: Knex.CreateTableBuilder): void => {
      id(table);
      table.string("name", 100).notNullable();
      table.string("accessKeyId", 200).notNullable();
      table.string("secretAccessKey", 200).notNullable();
      table.string("region", 100).notNullable();
      table.string("bucket", 200).notNullable();
      table.string("path", 200).nullable();
      table.string("endpoint", 200).nullable();
      table.string("publicUrl", 200).nullable();
    })
    .createTable(Table.Catalog, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Storage, "id");
      table.string("name", 100).notNullable();
    })
    .createTable(Table.Person, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Catalog, "id");
      table.string("name", 200).notNullable();

      table.unique([columnFor(Table.Catalog), "id"]);
    })
    .raw(
      nameIndex(Table.Person, Table.Catalog, null),
    )
    .createTable(Table.Tag, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Catalog, "id");
      table.string("parent", 30).nullable();
      table.string("name", 100).notNullable();
      table.unique([columnFor(Table.Catalog), "id"]);

      table.foreign([columnFor(Table.Catalog), "parent"], `foreign_${Table.Tag}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Tag);
    })
    .raw(
      nameIndex(Table.Tag, Table.Catalog),
    )
    .createTable(Table.Album, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Catalog, "id");
      table.string("parent", 30).nullable();
      table.string("name", 100).notNullable();

      table.unique([columnFor(Table.Catalog), "id"]);

      table.foreign([columnFor(Table.Catalog), "parent"], `foreign_${Table.Album}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Album);
    })
    .raw(
      nameIndex(Table.Album, Table.Catalog),
    )
    .createTable(Table.Media, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Catalog, "id");
      table.dateTime("created", { useTz: true }).notNullable();

      addMetadata(table);

      table.unique([columnFor(Table.Catalog), "id"]);
    })
    .createTable(Table.Original, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Media, "id");
      table.integer("processVersion").notNullable();
      table.dateTime("uploaded", { useTz: true }).notNullable();

      addFileInfo(table);
      addMetadata(table);
    })
    .createTable(Table.AlternateFile, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Original, "id");
      table.string("type", 20).notNullable();

      addFileInfo(table);
    })
    .createTable(Table.UserCatalog, (table: Knex.CreateTableBuilder): void => {
      foreignId(table, Table.User, "email");
      foreignId(table, Table.Catalog, "id");

      table.unique([columnFor(Table.User), columnFor(Table.Catalog)]);
    })
    .createTable(Table.MediaAlbum, (table: Knex.CreateTableBuilder): void => {
      table.string(columnFor(Table.Catalog), 30).notNullable();
      table.string(columnFor(Table.Media), 30).notNullable();
      table.string(columnFor(Table.Album), 30).notNullable();

      table.unique([columnFor(Table.Media), columnFor(Table.Album)], "uniqueAlbumMedia");

      table.foreign([columnFor(Table.Catalog), columnFor(Table.Media)], `foreign_${Table.Media}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Media);
      table.foreign([columnFor(Table.Catalog), columnFor(Table.Album)], `foreign_${Table.Album}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Album);
    })
    .createTable(Table.MediaTag, (table: Knex.CreateTableBuilder): void => {
      table.string(columnFor(Table.Catalog), 30).notNullable();
      table.string(columnFor(Table.Media), 30).notNullable();
      table.string(columnFor(Table.Tag), 30).notNullable();

      table.unique([columnFor(Table.Media), columnFor(Table.Tag)], "uniqueTagMedia");

      table.foreign([columnFor(Table.Catalog), columnFor(Table.Media)], `foreign_${Table.Media}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Media);
      table.foreign([columnFor(Table.Catalog), columnFor(Table.Tag)], `foreign_${Table.Tag}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Tag);
    })
    .createTable(Table.MediaPerson, (table: Knex.CreateTableBuilder): void => {
      table.string(columnFor(Table.Catalog), 30).notNullable();
      table.string(columnFor(Table.Media), 30).notNullable();
      table.string(columnFor(Table.Person), 30).notNullable();
      table.float("left").nullable();
      table.float("right").nullable();
      table.float("top").nullable();
      table.float("bottom").nullable();

      table.unique([columnFor(Table.Media), columnFor(Table.Person)], "uniquePersonMedia");

      table.foreign([columnFor(Table.Catalog), columnFor(Table.Media)], `foreign_${Table.Media}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Media);
      table.foreign([columnFor(Table.Catalog), columnFor(Table.Person)], `foreign_${Table.Person}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Person);
    })
    .raw(knex.raw("CREATE VIEW ?? AS ?", [
      Table.StoredMedia,
      buildMediaView(knex),
    ]).toString())
    .raw(knex.raw("CREATE VIEW ?? AS ?", [
      Table.StoredMediaDetail,
      buildMediaDetailView(knex),
    ]).toString());
};

/**
 * @param {Knex} knex
 * @return {Knex.SchemaBuilder}
 */
exports.down = function(knex: Knex): Knex.SchemaBuilder {
  return knex.schema
    .raw(knex.raw("DROP VIEW ??", [Table.StoredMediaDetail]).toString())
    .raw(knex.raw("DROP VIEW ??", [Table.StoredMedia]).toString())
    .dropTable(Table.MediaPerson)
    .dropTable(Table.MediaTag)
    .dropTable(Table.MediaAlbum)
    .dropTable(Table.UserCatalog)
    .dropTable(Table.AlternateFile)
    .dropTable(Table.Original)
    .dropTable(Table.Media)
    .dropTable(Table.Album)
    .dropTable(Table.Tag)
    .dropTable(Table.Person)
    .dropTable(Table.Catalog)
    .dropTable(Table.User);
};
