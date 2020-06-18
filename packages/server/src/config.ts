import path from "path";

import { DatabaseConfig } from "pixelbin-database";

const basedir = path.dirname(path.resolve(__dirname));

export interface ServerConfig {
  clientRoot: string;
  webserverRoot: string;
  database: DatabaseConfig;
}

const config: ServerConfig = {
  clientRoot: path.join(basedir, "node_modules", "pixelbin-client"),
  webserverRoot: path.join(basedir, "node_modules", "pixelbin-webserver"),
  database: {
    username: "pixelbin",
    password: "pixelbin",
    host: "localhost",
    database: "pixelbin",
  },
};

export default config;
