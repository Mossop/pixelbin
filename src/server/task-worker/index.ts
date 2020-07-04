import { getLogger } from "../../utils";
import { MasterProcess } from "../../worker";
import { connect } from "../database";
import { MasterInterface, TaskWorkerInterface } from "./interfaces";

const logger = getLogger("webserver");

async function main(): Promise<void> {
  logger.info("Task worker startup.");

  let connection = new MasterProcess<MasterInterface, TaskWorkerInterface>({
    localInterface: {
      handleUploadedFile: (_id: string): void => {
        return;
      },
    },
  });
  let master = await connection.remote;

  try {
    let config = await master.getConfig();
    connect(config.databaseConfig);
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error(error, "Task worker threw error while connecting.");
});
