import Knex from "knex";

import config from "../knexfile";

interface ExtendedKnex extends Knex {
  userParams: {
    schema?: string;
  }
}

let environment = process.env.NODE_ENV ?? "development";
if (!(environment in config)) {
  environment = "development";
}

export const knex = Knex(config[environment]) as ExtendedKnex;
