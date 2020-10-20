import { install } from "source-map-support";

import { getLogger, setLogConfig } from "../../utils";
import { Cache } from "../cache";
import { DatabaseConnection } from "../database";
import { StorageService } from "../storage";
import { ParentProcess } from "../worker";
import buildApp from "./app";
import events from "./events";
import { ParentProcessInterface } from "./interfaces";
import Services, { provideService } from "./services";

install();
const logger = getLogger("webserver");

async function shutdown(): Promise<void> {
  await (await Services.database).destroy();
  await (await Services.cache).destroy();
}

async function main(): Promise<void> {
  logger.info("Server startup.");

  let connection = await ParentProcess.connect<ParentProcessInterface>();
  try {
    let parent = connection.remote;
    connection.on("disconnect", () => void events.emit("shutdown"));
    provideService("parent", parent);

    let config = await parent.getConfig();

    setLogConfig(config.logConfig);

    let dbConnection = await DatabaseConnection.connect("webserver", config.databaseConfig);
    events.on("shutdown", () => logger.catch(shutdown()));

    provideService("database", dbConnection);

    provideService("storage", new StorageService(config.storageConfig, dbConnection));

    provideService("cache", Cache.connect({}));

    await buildApp();
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error(error, "Server threw error while connecting.");
});
