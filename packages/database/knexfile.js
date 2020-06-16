const path = require("path");

const TEST_SCHEMA = `test${process.pid}`;

/** @type {Record<string, import("knex").Knex.Config>} */
module.exports = {
  test: {
    client: "pg",
    connection: "postgres://pixelbin:pixelbin@localhost:5432/pixelbin_test",
    searchPath: [TEST_SCHEMA],
    migrations: {
      directory: path.join(__dirname, "src", "migrations"),
      schemaName: TEST_SCHEMA,
    },
    seeds: {
      directory: path.join(__dirname, "src", "seeds"),
    },
    userParams: {
      schema: TEST_SCHEMA,
    },
  },
  development: {
    client: "pg",
    connection: "postgres://pixelbin:pixelbin@localhost:5432/pixelbin",
    migrations: {
      directory: path.join(__dirname, "src", "migrations"),
    },
    seeds: {
      directory: path.join(__dirname, "src", "seeds"),
    },
  },
};
