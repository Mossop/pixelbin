import { exiftool } from "exiftool-vendored";
import { install } from "source-map-support";

import { getLogger, setLogConfig } from "../../utils";
import { ParentProcess } from "../../worker";
import { connect } from "../database";
import { StorageService } from "../storage";
import { ParentProcessInterface, TaskWorkerInterface } from "./interfaces";
import { handleUploadedFile } from "./process";
import { provideService } from "./services";

install();
const logger = getLogger("task-worker");

async function main(): Promise<void> {
  logger.info("Task worker startup.");

  let connection = new ParentProcess<ParentProcessInterface, TaskWorkerInterface>({
    localInterface: {
      handleUploadedFile,
    },
  });
  let parent = await connection.remote;

  connection.on("disconnect", (): void => {
    logger.catch(exiftool.end());
  });

  provideService("exiftool", exiftool);

  try {
    provideService("parent", parent);

    let config = await parent.getConfig();
    setLogConfig(config.logConfig);
    connect(config.databaseConfig);

    provideService("storage", new StorageService(config.storageConfig));
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error(error, "Task worker threw error while connecting.");
});
