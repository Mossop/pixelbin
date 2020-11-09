#!/usr/bin/env node
import { install } from "source-map-support";

import { getLogger, setLogConfig } from "../../utils";
import Scheduler from "../../utils/scheduler";
import { DatabaseConnection } from "../database";
import { Emailer } from "../email";
import { StorageService } from "../storage";
import type { ServerConfig } from "./config";
import { loadConfig } from "./config";
import events, { quit } from "./events";
import Services, { provideService } from "./services";
import { initTaskManager } from "./tasks";
import { initWebserver } from "./webserver";

install();
const logger = getLogger("server");

async function initDatabase(): Promise<DatabaseConnection> {
  let config = await Services.config;

  let dbConnection = await DatabaseConnection.connect("main", config.database);
  await dbConnection.migrate();

  events.on("shutdown", () => {
    logger.catch(dbConnection.destroy());
  });

  return dbConnection;
}

async function initStorage(): Promise<StorageService> {
  let config = await Services.config;
  return new StorageService(config.storage, await Services.database);
}

async function initEmail(): Promise<Emailer> {
  let config = await Services.config;
  return new Emailer(config.smtp);
}

function startupServices(): void {
  provideService("taskManager", initTaskManager());
  provideService("database", initDatabase());
  provideService("storage", initStorage());
  provideService("webServers", initWebserver());
  provideService("email", initEmail());
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

  startupServices();

  await reprocessUploads();
  await startSchedule();
}

async function main(args: string[]): Promise<void> {
  process.on("SIGTERM", (): void => {
    logger.trace("Received SIGTERM.");
    quit();
  });

  process.on("SIGINT", (): void => {
    logger.trace("Received SIGINT.");
    quit();
  });

  if (!args.length) {
    throw new Error("Must pass a config file or directory.");
  }

  let config = await loadConfig(args[0]);

  startup(config).catch((error: Error): void => {
    logger.error(error, "Server startup threw error.");
  });
}

main(process.argv.slice(2)).catch(console.error);
