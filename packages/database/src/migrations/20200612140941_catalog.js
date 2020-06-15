/**
 * @typedef {import("knex")} Knex
 */

/**
 * @param {Knex} knex
 * @return {Knex.SchemaBuilder}
 */
exports.up = function(knex) {
  return knex.schema.createTable("catalog", table => {
    table.string("id", 30).notNullable().unique().primary();
    table.string("name", 100).notNullable();
  });
};

/**
 * @param {Knex} knex
 * @return {Knex.SchemaBuilder}
 */
exports.down = function(knex) {
  return knex.schema.dropTable("catalog");
};
