import type Knex from "knex";

import { MetadataColumns } from "../../../model";
import type { TableRecord } from "../types";
import { Table, ref, nameConstraint, columnFor } from "../types";

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

function buildMediaView(knex: Knex): Knex.QueryBuilder {
  let mappings = {
    id: ref(Table.Media, "id"),
    catalog: ref(Table.Media, "catalog"),
    created: ref(Table.Media, "created"),
    deleted: ref(Table.Media, "deleted"),
    updated: knex.raw("GREATEST(?, ?)", [
      knex.ref(`${Table.Media}.updated`),
      knex.ref("CurrentOriginal.uploaded"),
    ]),
    original: "CurrentOriginal.id",
    uploaded: "CurrentOriginal.uploaded",
    mimetype: "CurrentOriginal.mimetype",
    width: "CurrentOriginal.width",
    height: "CurrentOriginal.height",
    duration: "CurrentOriginal.duration",
    fileSize: "CurrentOriginal.fileSize",
    fileName: "CurrentOriginal.fileName",
    frameRate: "CurrentOriginal.frameRate",
    bitRate: "CurrentOriginal.bitRate",
  };

  for (let field of Object.keys(MetadataColumns)) {
    mappings[field] = knex.raw("COALESCE(?, ?)", [
      knex.ref(`${Table.Media}.${field}`),
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
    .join(Table.Person, ref(Table.Person, "id"), ref(Table.MediaPerson, "person"))
    .groupBy(ref(Table.MediaPerson, "media"))
    .select({
      media: ref(Table.MediaPerson, "media"),
      people: knex.raw("json_agg((SELECT row_to_json(_) FROM (SELECT ??, ??, ??, ??) AS _))", [
        "id",
        "Person.catalog",
        "name",
        "location",
      ]),
    })
    .as("PersonList");

  return knex(Table.StoredMedia)
    .leftJoin(tags, "TagList.media", ref(Table.StoredMedia, "id"))
    .leftJoin(albums, "AlbumList.media", ref(Table.StoredMedia, "id"))
    .leftJoin(people, "PersonList.media", ref(Table.StoredMedia, "id"))
    .where(ref(Table.StoredMedia, "deleted"), false)
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
      user: ref(Table.Storage, "user"),
      catalog: ref(Table.Catalog, "id"),
      writable: knex.raw("true"),
    });

  return owns.union(shares);
}

exports.up = function(knex: Knex): Knex.SchemaBuilder {
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

  return knex.schema
    .raw(locationType.toString())
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
      foreignId(table, Table.User, "email");
      table.string("name", 100).notNullable();
      table.string("accessKeyId", 200).notNullable();
      table.string("secretAccessKey", 200).notNullable();
      table.string("bucket", 200).notNullable();
      table.string("region", 20).notNullable();
      table.string("path", 200).nullable();
      table.string("endpoint", 200).nullable();
      table.string("publicUrl", 200).nullable();
    })
    .createTable(Table.Catalog, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Storage, "id", "RESTRICT");
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
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Tag)
        .onDelete("CASCADE")
        .onUpdate("CASCADE");
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
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Album)
        .onDelete("CASCADE")
        .onUpdate("CASCADE");
    })
    .raw(
      nameIndex(Table.Album, Table.Catalog),
    )
    .createTable(Table.Media, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Catalog, "id", "RESTRICT");
      table.boolean("deleted").notNullable();
      table.dateTime("created", { useTz: true }).notNullable();
      table.dateTime("updated", { useTz: true }).notNullable();

      addMetadata(table);

      table.unique([columnFor(Table.Catalog), "id"]);
    })
    .createTable(Table.Original, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Media, "id", "RESTRICT");
      table.integer("processVersion").notNullable();
      table.dateTime("uploaded", { useTz: true }).notNullable();

      addFileInfo(table);
      addMetadata(table);
    })
    .createTable(Table.AlternateFile, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Original, "id", "RESTRICT");
      table.string("type", 20).notNullable();

      addFileInfo(table);
    })
    .createTable(Table.SavedSearch, (table: Knex.CreateTableBuilder): void => {
      id(table);
      foreignId(table, Table.Catalog, "id");
      table.string("name", 100).notNullable();
      table.json("query").notNullable();
    })
    .createTable(Table.SharedCatalog, (table: Knex.CreateTableBuilder): void => {
      foreignId(table, Table.User, "email");
      foreignId(table, Table.Catalog, "id");
      table.boolean("writable").notNullable();

      table.unique([columnFor(Table.User), columnFor(Table.Catalog)]);
    })
    .createTable(Table.MediaAlbum, (table: Knex.CreateTableBuilder): void => {
      table.string(columnFor(Table.Catalog), 30).notNullable();
      table.string(columnFor(Table.Media), 30).notNullable();
      table.string(columnFor(Table.Album), 30).notNullable();

      table.unique([columnFor(Table.Media), columnFor(Table.Album)], "uniqueAlbumMedia");

      table.foreign([columnFor(Table.Catalog), columnFor(Table.Media)], `foreign_${Table.Media}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Media)
        .onDelete("CASCADE")
        .onUpdate("CASCADE");
      table.foreign([columnFor(Table.Catalog), columnFor(Table.Album)], `foreign_${Table.Album}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Album)
        .onDelete("CASCADE")
        .onUpdate("CASCADE");
    })
    .createTable(Table.MediaTag, (table: Knex.CreateTableBuilder): void => {
      table.string(columnFor(Table.Catalog), 30).notNullable();
      table.string(columnFor(Table.Media), 30).notNullable();
      table.string(columnFor(Table.Tag), 30).notNullable();

      table.unique([columnFor(Table.Media), columnFor(Table.Tag)], "uniqueTagMedia");

      table.foreign([columnFor(Table.Catalog), columnFor(Table.Media)], `foreign_${Table.Media}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Media)
        .onDelete("CASCADE")
        .onUpdate("CASCADE");
      table.foreign([columnFor(Table.Catalog), columnFor(Table.Tag)], `foreign_${Table.Tag}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Tag)
        .onDelete("CASCADE")
        .onUpdate("CASCADE");
    })
    .createTable(Table.MediaPerson, (table: Knex.CreateTableBuilder): void => {
      table.string(columnFor(Table.Catalog), 30).notNullable();
      table.string(columnFor(Table.Media), 30).notNullable();
      table.string(columnFor(Table.Person), 30).notNullable();
      table.specificType("location", "location").nullable();

      table.unique([columnFor(Table.Media), columnFor(Table.Person)], "uniquePersonMedia");

      table.foreign([columnFor(Table.Catalog), columnFor(Table.Media)], `foreign_${Table.Media}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Media)
        .onDelete("CASCADE")
        .onUpdate("CASCADE");
      table.foreign([columnFor(Table.Catalog), columnFor(Table.Person)], `foreign_${Table.Person}`)
        .references([columnFor(Table.Catalog), "id"]).inTable(Table.Person)
        .onDelete("CASCADE")
        .onUpdate("CASCADE");
    })
    .raw(knex.raw("CREATE VIEW ?? AS ?", [
      Table.StoredMedia,
      buildMediaView(knex),
    ]).toString())
    .raw(knex.raw("CREATE VIEW ?? AS ?", [
      Table.StoredMediaDetail,
      buildMediaDetailView(knex),
    ]).toString())
    .raw(knex.raw("CREATE VIEW ?? AS ?", [
      Table.UserCatalog,
      buildUserCatalogView(knex),
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
