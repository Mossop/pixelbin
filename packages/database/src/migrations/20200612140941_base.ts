import Knex from "knex";

import { Table, ref, TableRecord } from "../types";

function id(table: Knex.CreateTableBuilder): void {
  table.string("id", 30).notNullable().unique().primary();
}

function foreignId<T extends Table, C extends keyof TableRecord<T>>(
  table: Knex.CreateTableBuilder,
  target: T,
  targetColumn: C,
  nullable: boolean = false,
  column: string = target.toLocaleLowerCase(),
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
    ]) {
      table.string(name, 200).nullable();
    }

    for (let name of [
      "orientation",
      "iso",
      "bitrate",
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

    table.dateTime("taken").nullable();
  }

  return knex.schema.createTable(Table.User, (table: Knex.CreateTableBuilder): void => {
    table.string("email", 100).notNullable().unique().primary();
    table.string("password", 200);
    table.string("fullname", 200);
    table.boolean("hadCatalog");
    table.boolean("verified");
  }).createTable(Table.Catalog, (table: Knex.CreateTableBuilder): void => {
    id(table);
    table.string("name", 100).notNullable();
  }).createTable(Table.Person, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog, "id");
    table.string("name", 200).notNullable();
    table.unique([Table.Catalog.toLocaleLowerCase(), "name"]);
  }).raw(
    `CREATE UNIQUE INDEX "person_unique_name" ON "${Table.Person}" ` +
    `("${Table.Catalog.toLocaleLowerCase()}", (LOWER("name")))`,
  ).createTable(Table.Tag, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog, "id");
    table.string("parent", 30).nullable();
    table.string("name", 100).notNullable();
    table.unique([Table.Catalog.toLocaleLowerCase(), "id"]);
    table.foreign([Table.Catalog.toLocaleLowerCase(), "parent"])
      .references([Table.Catalog.toLocaleLowerCase(), "id"]).inTable(Table.Tag);
  }).raw(
    `CREATE UNIQUE INDEX "tag_unique_name" ON "${Table.Tag}" ` +
    `("${Table.Catalog.toLocaleLowerCase()}", (COALESCE("parent", 'NONE')), (LOWER("name")))`,
  ).createTable(Table.Album, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog, "id");
    table.string("parent", 30).nullable();
    table.string("name", 100).notNullable();
    table.string("stub", 50).nullable();
    table.unique([Table.Catalog.toLocaleLowerCase(), "id"]);
    table.foreign([Table.Catalog.toLocaleLowerCase(), "parent"])
      .references([Table.Catalog.toLocaleLowerCase(), "id"]).inTable(Table.Album);
  }).raw(
    `CREATE UNIQUE INDEX "album_unique_name" ON "${Table.Album}" ` +
    `("${Table.Catalog.toLocaleLowerCase()}", (COALESCE("parent", 'NONE')), (LOWER("name")))`,
  ).createTable(Table.Media, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog, "id");
    table.dateTime("created").notNullable();

    addMetadata(table);
  }).createTable(Table.MediaInfo, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Media, "id");
    table.integer("processVersion").notNullable();
    table.dateTime("uploaded").notNullable();
    table.string("mimetype", 50).notNullable();
    table.integer("width").notNullable();
    table.integer("height").notNullable();
    table.integer("duration").nullable();
    table.integer("fileSize").nullable();

    addMetadata(table);
  }).createTable(Table.UserCatalog, (table: Knex.CreateTableBuilder): void => {
    foreignId(table, Table.User, "email");
    foreignId(table, Table.Catalog, "id");
    table.unique([Table.User.toLocaleLowerCase(), Table.Catalog.toLocaleLowerCase()]);
  }).createTable(Table.MediaAlbum, (table: Knex.CreateTableBuilder): void => {
    foreignId(table, Table.Media, "id");
    foreignId(table, Table.Album, "id");
    table.unique([Table.Media.toLocaleLowerCase(), Table.Album.toLocaleLowerCase()]);
  }).createTable(Table.MediaTag, (table: Knex.CreateTableBuilder): void => {
    foreignId(table, Table.Media, "id");
    foreignId(table, Table.Tag, "id");
    table.unique([Table.Media.toLocaleLowerCase(), Table.Tag.toLocaleLowerCase()]);
  }).createTable(Table.MediaPerson, (table: Knex.CreateTableBuilder): void => {
    foreignId(table, Table.Media, "id");
    foreignId(table, Table.Person, "id");
    table.unique([Table.Media.toLocaleLowerCase(), Table.Person.toLocaleLowerCase()]);
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
    .dropTable("mediaInfo")
    .dropTable("media")
    .dropTable("album")
    .dropTable("tag")
    .dropTable("person")
    .dropTable("catalog")
    .dropTable("user");
};
