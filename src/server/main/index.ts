#!/usr/bin/env node
import { install } from "source-map-support";

import { getLogger, setLogConfig } from "../../utils";
import { DatabaseConnection } from "../database";
import { StorageService } from "../storage";
import { loadConfig, ServerConfig } from "./config";
import events, { quit } from "./events";
import services, { provideService } from "./services";
import { TaskManager } from "./tasks";
import { WebserverManager } from "./webserver";

install();
const logger = getLogger("server");

async function initDatabase(): Promise<void> {
  let config = await services.config;

  let dbConnection = await DatabaseConnection.connect(config.database);
  await dbConnection.knex.migrate.latest();
  provideService("database", dbConnection);

  events.on("shutdown", () => {
    logger.catch(dbConnection.destroy());
  });
}

async function startupServers(): Promise<void> {
  await TaskManager.init();
  await WebserverManager.init();

  let config = await services.config;
  let storage = new StorageService(config.storageConfig, await services.database);
  provideService("storage", storage);
}

async function reprocessUploads(): Promise<void> {
  let service = await services.storage;
  let taskManager = await services.taskManager;
  for await (let file of service.listUploadedFiles()) {
    await taskManager.handleUploadedFile(file.media);
  }
}

async function startup(config: ServerConfig): Promise<void> {
  setLogConfig(config.logConfig);
  provideService("config", config);

  await initDatabase();
  await startupServers();
  await reprocessUploads();
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
