import { getLogger } from "../../utils";
import { ParentProcess } from "../../worker";
import { connect } from "../database";
import { ParentProcessInterface, TaskWorkerInterface } from "./interfaces";

const logger = getLogger("webserver");

async function main(): Promise<void> {
  logger.info("Task worker startup.");

  let connection = new ParentProcess<ParentProcessInterface, TaskWorkerInterface>({
    localInterface: {
      handleUploadedFile: (_id: string): void => {
        return;
      },
    },
  });
  let parent = await connection.remote;

  try {
    let config = await parent.getConfig();
    connect(config.databaseConfig);
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error(error, "Task worker threw error while connecting.");
});
