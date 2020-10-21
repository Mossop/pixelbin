import { exiftool } from "exiftool-vendored";
import { install } from "source-map-support";

import { getLogger, setLogConfig } from "../../utils";
import { DatabaseConnection } from "../database";
import { StorageService } from "../storage";
import { ParentProcess } from "../worker";
import events from "./events";
import { ParentProcessInterface, TaskWorkerInterface } from "./interfaces";
import { handleUploadedFile, purgeDeletedMedia } from "./process";
import { provideService } from "./services";

install();
const logger = getLogger("task-worker");

async function main(): Promise<void> {
  logger.info("Task worker startup.");

  let connection = await ParentProcess.connect<ParentProcessInterface, TaskWorkerInterface>({
    localInterface: {
      handleUploadedFile,
      purgeDeletedMedia,
    },
    logger,
  });
  let parent = connection.remote;

  connection.on("disconnect", () => void events.emit("shutdown"));

  provideService("exiftool", exiftool);
  events.on("shutdown", () => logger.catch(exiftool.end()));

  try {
    provideService("parent", parent);

    let config = await parent.getConfig();
    setLogConfig(config.logging);

    let dbConnection = await DatabaseConnection.connect("tasks", config.database);
    provideService("database", dbConnection);
    events.on("shutdown", () => logger.catch(dbConnection.destroy()));

    provideService("storage", new StorageService(config.storage, dbConnection));
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error(error, "Task worker threw error while connecting.");
});