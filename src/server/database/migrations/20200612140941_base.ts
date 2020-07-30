import Knex from "knex";

import { Table, ref, TableRecord } from "../types";
import { nameConstraint } from "../types/constraints";
import { columnFor } from "../types/meta";

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
  table.foreign(column).references(ref(target, targetColumn)).onDelete("CASCADE");
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

  return knex.schema.createTable(Table.User, (table: Knex.CreateTableBuilder): void => {
    table.string("email", 100).notNullable().unique().primary();
    table.string("password", 200);
    table.string("fullname", 200);
    table.boolean("hadCatalog");
    table.boolean("verified");
  }).createTable(Table.Storage, (table: Knex.CreateTableBuilder): void => {
    id(table);
    table.string("name", 100).notNullable();
    table.string("accessKeyId", 200).notNullable();
    table.string("secretAccessKey", 200).notNullable();
    table.string("region", 100).notNullable();
    table.string("bucket", 200).notNullable();
    table.string("path", 200).nullable();
    table.string("endpoint", 200).nullable();
    table.string("publicUrl", 200).nullable();
  }).createTable(Table.Catalog, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Storage, "id");
    table.string("name", 100).notNullable();
  }).createTable(Table.Person, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog, "id");
    table.string("name", 200).notNullable();

    table.unique([columnFor(Table.Catalog), "id"]);
  }).raw(
    nameIndex(Table.Person, Table.Catalog, null),
  ).createTable(Table.Tag, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog, "id");
    table.string("parent", 30).nullable();
    table.string("name", 100).notNullable();
    table.unique([columnFor(Table.Catalog), "id"]);

    table.foreign([columnFor(Table.Catalog), "parent"])
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Tag);
  }).raw(
    nameIndex(Table.Tag, Table.Catalog),
  ).createTable(Table.Album, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog, "id");
    table.string("parent", 30).nullable();
    table.string("name", 100).notNullable();
    table.string("stub", 50).nullable();

    table.unique([columnFor(Table.Catalog), "id"]);

    table.foreign([columnFor(Table.Catalog), "parent"])
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Album);
  }).raw(
    nameIndex(Table.Album, Table.Catalog),
  ).createTable(Table.Media, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog, "id");
    table.dateTime("created", { useTz: true }).notNullable();

    addMetadata(table);

    table.unique([columnFor(Table.Catalog), "id"]);
  }).createTable(Table.UploadedMedia, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Media, "id");
    table.integer("processVersion").notNullable();
    table.dateTime("uploaded", { useTz: true }).notNullable();

    addFileInfo(table);
    addMetadata(table);
  }).createTable(Table.AlternateFile, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.UploadedMedia, "id");
    table.string("type", 20).notNullable();

    addFileInfo(table);
  }).createTable(Table.UserCatalog, (table: Knex.CreateTableBuilder): void => {
    foreignId(table, Table.User, "email");
    foreignId(table, Table.Catalog, "id");

    table.unique([columnFor(Table.User), columnFor(Table.Catalog)]);
  }).createTable(Table.MediaAlbum, (table: Knex.CreateTableBuilder): void => {
    table.string(columnFor(Table.Catalog), 30).notNullable();
    table.string(columnFor(Table.Media), 30).notNullable();
    table.string(columnFor(Table.Album), 30).notNullable();

    table.unique([columnFor(Table.Media), columnFor(Table.Album)]);

    table.foreign([columnFor(Table.Catalog), columnFor(Table.Media)])
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Media);
    table.foreign([columnFor(Table.Catalog), columnFor(Table.Album)])
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Album);
  }).createTable(Table.MediaTag, (table: Knex.CreateTableBuilder): void => {
    table.string(columnFor(Table.Catalog), 30).notNullable();
    table.string(columnFor(Table.Media), 30).notNullable();
    table.string(columnFor(Table.Tag), 30).notNullable();

    table.unique([columnFor(Table.Media), columnFor(Table.Tag)]);

    table.foreign([columnFor(Table.Catalog), columnFor(Table.Media)])
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Media);
    table.foreign([columnFor(Table.Catalog), columnFor(Table.Tag)])
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Tag);
  }).createTable(Table.MediaPerson, (table: Knex.CreateTableBuilder): void => {
    table.string(columnFor(Table.Catalog), 30).notNullable();
    table.string(columnFor(Table.Media), 30).notNullable();
    table.string(columnFor(Table.Person), 30).notNullable();

    table.unique([columnFor(Table.Media), columnFor(Table.Person)]);

    table.foreign([columnFor(Table.Catalog), columnFor(Table.Media)])
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Media);
    table.foreign([columnFor(Table.Catalog), columnFor(Table.Person)])
      .references([columnFor(Table.Catalog), "id"]).inTable(Table.Person);
  });
};

/**
 * @param {Knex} knex
 * @return {Knex.SchemaBuilder}
 */
exports.down = function(knex: Knex): Knex.SchemaBuilder {
  return knex.schema
    .dropTable("media_person")
    .dropTable("media_tag")
    .dropTable("media_album")
    .dropTable("user_catalog")
    .dropTable("uploadedMedia")
    .dropTable("media")
    .dropTable("album")
    .dropTable("tag")
    .dropTable("person")
    .dropTable("catalog")
    .dropTable("user");
};
