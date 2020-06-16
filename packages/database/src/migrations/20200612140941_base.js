/**
 * @typedef {import("knex")} Knex
 */

/**
 * @param {Knex.CreateTableBuilder} table
 * @return {void}
 */
function id(table) {
  table.string("id", 30).notNullable().unique().primary();
}

/**
 * @param {Knex.CreateTableBuilder} table
 * @param {string} target
 * @param {boolean} nullable
 * @param {string} column
 * @return {void}
 */
function foreignId(table, target, nullable = false, column = target) {
  let col = table.string(column, 30);
  if (!nullable) {
    col.notNullable();
  } else {
    col.nullable();
  }
  table.foreign(column).references(`${target}.id`).onDelete("CASCADE");
}

/**
 * @param {Knex} knex
 * @return {Knex.SchemaBuilder}
 */
exports.up = function(knex) {
  function addMetadata(table) {
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

  return knex.schema.createTable("user", table => {
    id(table);
    table.string("email", 100).notNullable().unique();
    table.string("fullname", 200);
    table.boolean("hadCatalog");
    table.boolean("verified");
  }).createTable("catalog", table => {
    id(table);
    table.string("name", 100).notNullable();
  }).createTable("person", table => {
    id(table);
    foreignId(table, "catalog");
    table.string("name", 200).notNullable();
  }).createTable("tag", table => {
    id(table);
    foreignId(table, "catalog");
    foreignId(table, "tag", true, "parent");
    table.string("name", 100).notNullable();
  }).createTable("album", table => {
    id(table);
    foreignId(table, "catalog");
    foreignId(table, "album", true, "parent");
    table.string("stub", 50).nullable();
    table.string("name", 100).notNullable();
  }).createTable("media", table => {
    id(table);
    foreignId(table, "catalog");
    table.dateTime("created").notNullable();

    addMetadata(table);
  }).createTable("mediaInfo", table => {
    id(table);
    foreignId(table, "media");
    table.integer("processVersion").notNullable();
    table.dateTime("uploaded").notNullable();
    table.string("mimetype", 50).notNullable();
    table.integer("width").notNullable();
    table.integer("height").notNullable();
    table.integer("duration").nullable();
    table.integer("fileSize").nullable();

    addMetadata(table);
  }).createTable("user_catalog", table => {
    foreignId(table, "user");
    foreignId(table, "catalog");
  }).createTable("media_album", table => {
    foreignId(table, "media");
    foreignId(table, "album");
  }).createTable("media_tag", table => {
    foreignId(table, "media");
    foreignId(table, "tag");
  }).createTable("media_person", table => {
    foreignId(table, "media");
    foreignId(table, "album");
  });
};

/**
 * @param {Knex} knex
 * @return {Knex.SchemaBuilder}
 */
exports.down = async function(knex) {
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
