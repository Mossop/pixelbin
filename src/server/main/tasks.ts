import child_process from "child_process";

import { getLogger, bound } from "../../utils";
import type {
  TaskWorkerConfig,
  ParentProcessInterface,
  TaskWorkerInterface,
} from "../task-worker/interfaces";
import type { AbstractChildProcess } from "../worker";
import { WorkerPool } from "../worker";
import { quit } from "./events";
import { Service } from "./service";
import Services from "./services";

export type TaskConfig = TaskWorkerConfig & {
  taskWorkerPackage: string;
};

const logger = getLogger("tasks-manager");

export class TaskManager extends Service {
  private readonly pool: WorkerPool<TaskWorkerInterface, ParentProcessInterface>;

  public constructor(private readonly config: TaskConfig) {
    super(logger);

    this.pool = new WorkerPool<TaskWorkerInterface, ParentProcessInterface>({
      localInterface: bound(this.interface, this),
      minWorkers: 0,
      maxWorkers: 4,
      maxTasksPerWorker: 3,
      logger,
      fork: async (): Promise<AbstractChildProcess> => {
        logger.trace("Forking new task worker process.");
        return child_process.fork(config.taskWorkerPackage, [], {
          serialization: "advanced",
        });
      },
    });

    this.pool.on("shutdown", quit);
  }

  protected async shutdown(): Promise<void> {
    this.pool.shutdown();
  }

  public canStartTask(): boolean {
    return this.pool.queueLength < 12;
  }

  public handleUploadedFile(id: string): void {
    this.logger.catch(this.pool.remote.handleUploadedFile(id));
  }

  public purgeDeletedMedia(): void {
    this.logger.catch(this.pool.remote.purgeDeletedMedia());
  }

  // ParentProcessInterface
  private interface: ParentProcessInterface = {
    getConfig(this: TaskManager): TaskWorkerConfig {
      return this.config;
    },
  };
}

export async function initTaskManager(): Promise<TaskManager> {
  let config = await Services.config;
  return new TaskManager({
    taskWorkerPackage: config.taskWorkerPackage,
    database: config.database,
    logging: config.logging,
    storage: config.storage,
  });
}
