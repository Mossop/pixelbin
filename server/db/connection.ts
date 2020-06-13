import knex from "knex";

import config from "../knexfile";

const environment = process.env.NODE_ENV ?? "development";

export default knex(config[environment]);
