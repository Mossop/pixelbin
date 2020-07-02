#!/usr/bin/env node

import child_process from "child_process";
import net from "net";
import path from "path";

import { getLogger, listen } from "../../utils";
import { WorkerPool, AbstractChildProcess } from "../../worker";
import { connect } from "../database";
import type { MasterInterface, WebserverConfig } from "../webserver";
import config from "./config";
import events from "./events";

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
  const server = net.createServer();
  await listen(server, 8000);
  logger.info("Listening on http://localhost:8000");

  let pool = new WorkerPool<undefined, MasterInterface>({
    localInterface: {
      getServer: (): net.Server => server,
      getConfig: (): WebserverConfig => ({
        staticRoot: path.join(config.clientRoot, "static"),
        appRoot: path.join(config.clientRoot),
        database: config.database,
        secretKeys: ["Random secret"],
        logConfig: config.logConfig,
        tempStorage: "",
        localStorage: "",
      }),
    },
    minWorkers: 4,
    maxWorkers: 8,
    fork: async (): Promise<AbstractChildProcess> => {
      logger.trace("Forking new process.");
      return child_process.fork(config.webserverPackage, [], {
        serialization: "advanced",
      });
    },
  });

  events.on("shutdown", (): void => {
    server.close();
    pool.shutdown();
  });
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
    quit();
  });

  process.on("SIGINT", (): void => {
    quit();
  });

  startup().catch((error: Error): void => {
    logger.error(error, "Server startup threw error.");
  });
}
