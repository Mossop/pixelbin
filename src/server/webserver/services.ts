import { RemoteInterface } from "../../worker";
import { DatabaseConnection } from "../database";
import { StorageService } from "../storage";
import { TaskWorkerInterface } from "../task-worker/interfaces";
import { ParentProcessInterface } from "./interfaces";

export type ServicesContext = {
  readonly storage: StorageService;
  readonly taskWorker: RemoteInterface<TaskWorkerInterface>;
  readonly dbConnection: DatabaseConnection;
};

export async function initServices(
  parent: RemoteInterface<ParentProcessInterface>,
): Promise<ServicesContext> {
  let config = await parent.getConfig();
  let dbConnection = await DatabaseConnection.connect(config.databaseConfig);

  return {
    storage: new StorageService(config.storageConfig, dbConnection),
    taskWorker: parent,
    dbConnection,
  };
}
