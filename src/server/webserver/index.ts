import { install } from "source-map-support";

import { getLogger, setLogConfig } from "../../utils";
import { DatabaseConnection } from "../database";
import { StorageService } from "../storage";
import { ParentProcess } from "../worker";
import buildApp from "./app";
import events from "./events";
import { ParentProcessInterface } from "./interfaces";
import { provideService } from "./services";

install();
const logger = getLogger("webserver");

async function main(): Promise<void> {
  logger.info("Server startup.");

  let connection = new ParentProcess<ParentProcessInterface>();
  try {
    let parent = await connection.remote;
    connection.on("disconnect", () => void events.emit("shutdown"));
    provideService("parent", parent);

    let config = await parent.getConfig();

    setLogConfig(config.logConfig);

    let dbConnection = await DatabaseConnection.connect(config.databaseConfig);
    events.on("shutdown", () => logger.catch(dbConnection.destroy()));
    provideService("database", dbConnection);

    provideService("storage", new StorageService(config.storageConfig, dbConnection));

    await buildApp();
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error(error, "Server threw error while connecting.");
});
