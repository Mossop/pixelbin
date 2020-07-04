import { RemoteInterface } from "../../worker";
import { StorageService } from "../storage";
import { TaskWorkerInterface } from "../task-worker/interfaces";
import { MasterInterface } from "./interfaces";

export type ServicesContext = RemoteInterface<TaskWorkerInterface> & {
  readonly storage: StorageService;
};

export async function initServices(
  master: RemoteInterface<MasterInterface>,
): Promise<ServicesContext> {
  let config = await master.getConfig();

  return {
    storage: new StorageService(config.storageConfig),
    ...master,
  };
}
