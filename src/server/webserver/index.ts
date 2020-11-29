import type net from "net";

import { install } from "source-map-support";

import { getLogger, NDJsonTransport, setLogConfig } from "../../utils";
import { Cache } from "../cache";
import { DatabaseConnection } from "../database";
import { StorageService } from "../storage";
import { ParentProcess } from "../worker";
import buildApp from "./app";
import events from "./events";
import type { ParentProcessInterface, WebserverInterface } from "./interfaces";
import Services, { provideService } from "./services";

install();
const logger = getLogger();
logger.name = "web-worker";
logger.config.transport = new NDJsonTransport(process.stdout);

async function shutdown(): Promise<void> {
  await (await Services.database).destroy();
  await (await Services.cache).destroy();
}

async function handleConnection(socket: net.Socket): Promise<void> {
  let server = await Services.server;
  socket.resume();
  server.emit("connection", socket);

  await new Promise<void>((resolve: () => void) => {
    socket.on("close", resolve);
  });
}

async function main(): Promise<void> {
  logger.info("Server startup.");

  let connection = await ParentProcess.connect<ParentProcessInterface, WebserverInterface>({
    logger,
    localInterface: {
      handleConnection,
    },
  });

  try {
    let parent = connection.remote;
    connection.on("disconnect", () => void events.emit("shutdown"));
    provideService("parent", parent);

    let config = await parent.getConfig();

    setLogConfig(config.logging);

    let dbConnection = await DatabaseConnection.connect(config.database);
    events.on("shutdown", () => logger.catch(shutdown()));

    provideService("database", dbConnection);

    provideService("storage", new StorageService(config.storage, dbConnection));

    provideService("cache", Cache.connect(config.cache));

    await buildApp();
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error({ error }, "Server threw error while connecting.");
});
