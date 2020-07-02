import child_process from "child_process";

import { getLogger } from "../../utils";
import { WorkerPool, AbstractChildProcess } from "../../worker";
import { TaskWorkerConfig, MasterInterface, TaskWorkerInterface } from "../task-worker/types";

export type TaskConfig = TaskWorkerConfig & {
  taskWorkerPackage: string;
};

const logger = getLogger("tasks");

export class TaskManager {
  private readonly pool: WorkerPool<TaskWorkerInterface, MasterInterface>;

  public constructor(private readonly config: TaskConfig) {
    this.pool = new WorkerPool<TaskWorkerInterface, MasterInterface>({
      localInterface: {
        getConfig: (): TaskWorkerConfig => this.config,
      },
      minWorkers: 0,
      maxWorkers: 4,
      fork: async (): Promise<AbstractChildProcess> => {
        logger.trace("Forking new task worker process.");
        return child_process.fork(config.taskWorkerPackage, [], {
          serialization: "advanced",
        });
      },
    });
  }

  public handleUploadedFile(_id: string): void {
    return;
  }
}
