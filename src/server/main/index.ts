#!/usr/bin/env node
import { install } from "source-map-support";

import { getLogger, setLogConfig } from "../../utils";
import Scheduler from "../../utils/scheduler";
import { DatabaseConnection } from "../database";
import { StorageService } from "../storage";
import { loadConfig, ServerConfig } from "./config";
import events, { quit } from "./events";
import Services, { provideService } from "./services";
import { TaskManager } from "./tasks";
import { WebserverManager } from "./webserver";

install();
const logger = getLogger("server");

async function initDatabase(): Promise<void> {
  let config = await Services.config;

  let dbConnection = await DatabaseConnection.connect("main", config.database);
  await dbConnection.knex.migrate.latest();
  provideService("database", dbConnection);

  events.on("shutdown", () => {
    logger.catch(dbConnection.destroy());
  });
}

async function startupServers(): Promise<void> {
  await TaskManager.init();
  await WebserverManager.init();

  let config = await Services.config;
  let storage = new StorageService(config.storage, await Services.database);
  provideService("storage", storage);
}

async function reprocessUploads(): Promise<void> {
  let service = await Services.storage;
  let taskManager = await Services.taskManager;
  for await (let file of service.listUploadedFiles()) {
    taskManager.handleUploadedFile(file.media);
  }
}

async function startSchedule(): Promise<void> {
  let scheduler = await Services.scheduler;

  async function purge(): Promise<void> {
    let manager = await Services.taskManager;
    manager.purgeDeletedMedia();
    scheduler.schedule("purge", 5 * 60 * 1000, purge);
  }

  scheduler.schedule("purge", 30000, purge);
}

async function startup(config: ServerConfig): Promise<void> {
  setLogConfig(config.logging);
  provideService("config", config);
  provideService("scheduler", new Scheduler());

  await initDatabase();
  await startupServers();
  await reprocessUploads();
  await startSchedule();
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
