import { RemoteInterface } from "../../worker";
import { StorageService } from "../storage";
import { TaskWorkerInterface } from "../task-worker/interfaces";
import { ParentProcessInterface } from "./interfaces";

export type ServicesContext = RemoteInterface<TaskWorkerInterface> & {
  readonly storage: StorageService;
};

export async function initServices(
  parent: RemoteInterface<ParentProcessInterface>,
): Promise<ServicesContext> {
  let config = await parent.getConfig();

  return {
    storage: new StorageService(config.storageConfig),
    ...parent,
  };
}
