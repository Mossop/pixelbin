#!/usr/bin/env node

import path from "path";

import { install } from "source-map-support";

import { getLogger, setLogConfig } from "../../utils";
import { DatabaseConnection } from "../database";
import { loadConfig, ServerConfig } from "./config";
import { quit } from "./events";
import { TaskManager } from "./tasks";
import { WebserverManager } from "./webserver";

install();
const logger = getLogger("server");

async function initDatabase(config: ServerConfig): Promise<void> {
  let dbConnection = await DatabaseConnection.connect(config.database);
  await dbConnection.knex.migrate.latest();
  await dbConnection.destroy();
}

async function startupServers(config: ServerConfig): Promise<void> {
  let taskManager = new TaskManager({
    databaseConfig: config.database,
    logConfig: config.logConfig,
    taskWorkerPackage: config.taskWorkerPackage,
    storageConfig: config.storageConfig,
  });

  new WebserverManager({
    webserverPackage: config.webserverPackage,
    staticRoot: path.join(config.clientRoot, "static"),
    appRoot: path.join(config.clientRoot),
    databaseConfig: config.database,
    secretKeys: ["Random secret"],
    logConfig: config.logConfig,
    storageConfig: config.storageConfig,
  }, taskManager);
}

async function startup(config: ServerConfig): Promise<void> {
  setLogConfig(config.logConfig);

  await initDatabase(config);
  await startupServers(config);
}

export async function main(args: string[]): Promise<void> {
  process.on("SIGTERM", (): void => {
    logger.trace("Received SIGTERM.");
    quit();
  });

  process.on("SIGINT", (): void => {
    logger.trace("Received SIGINT.");
    quit();
  });

  if (!args.length) {
    throw new Error("Must pass a config file.");
  }

  let config = await loadConfig(args[0]);

  startup(config).catch((error: Error): void => {
    logger.error(error, "Server startup threw error.");
  });
}
