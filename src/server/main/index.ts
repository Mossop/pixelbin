#!/usr/bin/env node

import path from "path";

import { install } from "source-map-support";

import { getLogger, setLogConfig } from "../../utils";
import { DatabaseConnection } from "../database";
import config from "./config";
import { quit } from "./events";
import { TaskManager } from "./tasks";
import { WebserverManager } from "./webserver";

install();
const logger = getLogger("server");

async function initDatabase(): Promise<void> {
  let dbConnection = await DatabaseConnection.connect(config.database);
  await dbConnection.knex.migrate.latest();
  await dbConnection.destroy();
}

async function startupServers(): Promise<void> {
  let taskManager = new TaskManager({
    databaseConfig: config.database,
    logConfig: config.logConfig,
    taskWorkerPackage: config.taskWorkerPackage,
    storageConfig: {
      tempDirectory: "",
      localDirectory: "",
    },
  });

  new WebserverManager({
    webserverPackage: config.webserverPackage,
    staticRoot: path.join(config.clientRoot, "static"),
    appRoot: path.join(config.clientRoot),
    databaseConfig: config.database,
    secretKeys: ["Random secret"],
    logConfig: config.logConfig,
    storageConfig: {
      tempDirectory: "",
      localDirectory: "",
    },
  }, taskManager);
}

async function startup(): Promise<void> {
  setLogConfig(config.logConfig);

  await initDatabase();
  await startupServers();
}

export function main(): void {
  process.on("SIGTERM", (): void => {
    logger.trace("Received SIGTERM.");
    quit();
  });

  process.on("SIGINT", (): void => {
    logger.trace("Received SIGINT.");
    quit();
  });

  startup().catch((error: Error): void => {
    logger.error(error, "Server startup threw error.");
  });
}