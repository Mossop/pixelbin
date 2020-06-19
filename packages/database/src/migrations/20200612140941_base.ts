import Knex from "knex";

import { Table } from "../types";

function id(table: Knex.CreateTableBuilder): void {
  table.string("id", 30).notNullable().unique().primary();
}

function foreignId(
  table: Knex.CreateTableBuilder,
  target: Table,
  targetColumn: string = "id",
  nullable: boolean = false,
  column: string = target.toLocaleLowerCase(),
): void {
  let col = table.string(column, 30);
  if (!nullable) {
    col.notNullable();
  } else {
    col.nullable();
  }
  table.foreign(column).references(`${target}.${targetColumn}`).onDelete("CASCADE");
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
    foreignId(table, Table.Catalog);
    table.string("name", 200).notNullable();
  }).createTable(Table.Tag, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog);
    foreignId(table, Table.Tag, "id", true, "parent");
    table.string("name", 100).notNullable();
  }).createTable(Table.Album, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog);
    foreignId(table, Table.Album, "id", true, "parent");
    table.string("stub", 50).nullable();
    table.string("name", 100).notNullable();
  }).createTable(Table.Media, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Catalog);
    table.dateTime("created").notNullable();

    addMetadata(table);
  }).createTable(Table.MediaInfo, (table: Knex.CreateTableBuilder): void => {
    id(table);
    foreignId(table, Table.Media);
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
    foreignId(table, Table.Catalog);
  }).createTable(Table.MediaAlbum, (table: Knex.CreateTableBuilder): void => {
    foreignId(table, Table.Media);
    foreignId(table, Table.Album);
  }).createTable(Table.MediaTag, (table: Knex.CreateTableBuilder): void => {
    foreignId(table, Table.Media);
    foreignId(table, Table.Tag);
  }).createTable(Table.MediaPerson, (table: Knex.CreateTableBuilder): void => {
    foreignId(table, Table.Media);
    foreignId(table, Table.Person);
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
