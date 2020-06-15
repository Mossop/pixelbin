const path = require("path");

const BASE_PATH = path.join(__dirname, "db");

module.exports = {
  test: {
    client: "pg",
    connection: "postgres://pixelbin:pixelbin@localhost:5432/pixelbin_test",
    migrations: {
      directory: path.join(BASE_PATH, "migrations"),
    },
    seeds: {
      directory: path.join(BASE_PATH, "seeds"),
    },
  },
  development: {
    client: "pg",
    connection: "postgres://pixelbin:pixelbin@localhost:5432/pixelbin",
    migrations: {
      directory: path.join(BASE_PATH, "migrations"),
    },
    seeds: {
      directory: path.join(BASE_PATH, "seeds"),
    },
  },
};
