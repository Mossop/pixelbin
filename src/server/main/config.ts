import path from "path";

import { LogConfig } from "../../utils";
import { DatabaseConfig } from "../database";

const basedir = path.resolve(path.join(__dirname, "..", ".."));

export interface ServerConfig {
  clientRoot: string;
  webserverPackage: string;
  taskWorkerPackage: string;
  database: DatabaseConfig;
  logConfig: LogConfig;
}

const config: ServerConfig = {
  clientRoot: path.join(basedir, "client"),
  webserverPackage: path.join(basedir, "server", "webserver"),
  taskWorkerPackage: path.join(basedir, "server", "task-worker"),
  database: {
    username: "pixelbin",
    password: "pixelbin",
    host: "localhost",
    database: "pixelbin",
  },
  logConfig: {
    default: "debug",
  },
};

export default config;
