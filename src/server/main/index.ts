#!/usr/bin/env node

import path from "path";

import { getLogger } from "../../utils";
import { connect } from "../database";
import config from "./config";
import events from "./events";
import { TaskManager } from "./tasks";
import { WebserverManager } from "./webserver";

const logger = getLogger("server");

async function initDatabase(): Promise<void> {
  let knex = connect(config.database);
  await knex.migrate.latest();

  events.on("shutdown", (): void => {
    knex.destroy().catch((error: Error): void => {
      logger.error({ error }, "Database shutdown threw error.");
    });
  });
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
  await initDatabase();
  await startupServers();
}

export function main(): void {
  function quit(): void {
    events.emit("shutdown");

    let quitTimeout = setTimeout((): void => {
      logger.warn("Forcibly quitting main process.");
      process.exit(1);
    }, 5000);

    quitTimeout.unref();
  }

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
