import child_process from "child_process";

import { getLogger, bound } from "../../utils";
import {
  TaskWorkerConfig,
  ParentProcessInterface,
  TaskWorkerInterface,
} from "../task-worker/interfaces";
import { WorkerPool, AbstractChildProcess } from "../worker";
import { quit } from "./events";
import { Service } from "./service";
import services, { provideService } from "./services";

export type TaskConfig = TaskWorkerConfig & {
  taskWorkerPackage: string;
};

const logger = getLogger("tasks");

export class TaskManager extends Service {
  private readonly pool: WorkerPool<TaskWorkerInterface, ParentProcessInterface>;

  private constructor(private readonly config: TaskConfig) {
    super(logger);

    this.pool = new WorkerPool<TaskWorkerInterface, ParentProcessInterface>({
      localInterface: bound(this.interface, this),
      minWorkers: 0,
      maxWorkers: 4,
      maxTasksPerWorker: 3,
      fork: async (): Promise<AbstractChildProcess> => {
        logger.trace("Forking new task worker process.");
        return child_process.fork(config.taskWorkerPackage, [], {
          serialization: "advanced",
        });
      },
    });

    this.pool.on("shutdown", quit);
  }

  public static async init(): Promise<void> {
    let config = await services.config;
    let taskManager = new TaskManager({
      taskWorkerPackage: config.taskWorkerPackage,
      database: config.database,
      logging: config.logging,
      storage: config.storage,
    });

    provideService("taskManager", taskManager);
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

  // ParentProcessInterface
  private interface: ParentProcessInterface = {
    getConfig(this: TaskManager): TaskWorkerConfig {
      return this.config;
    },
  };
}
