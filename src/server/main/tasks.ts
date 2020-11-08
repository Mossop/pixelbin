import child_process from "child_process";
import path from "path";

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

const BACKOFF_DELAYS = [
  1 * 60000,
  2 * 60000,
  5 * 60000,
  10 * 60000,
  30 * 60000,
];

export type TaskConfig = TaskWorkerConfig;

const logger = getLogger("tasks-manager");

export class TaskManager extends Service {
  private readonly pool: WorkerPool<TaskWorkerInterface, ParentProcessInterface>;

  public constructor(private readonly config: TaskConfig) {
    super(logger);

    let module = path.resolve(path.join(path.dirname(__dirname), "task-worker"));

    this.pool = new WorkerPool<TaskWorkerInterface, ParentProcessInterface>({
      localInterface: bound(this.interface, this),
      minWorkers: 0,
      maxWorkers: 4,
      maxTasksPerWorker: 3,
      logger,
      fork: async (): Promise<AbstractChildProcess> => {
        logger.trace("Forking new task worker process.");
        return child_process.fork(module, [], {
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

  public handleUploadedFile(mediaId: string, attempt: number = 0): void {
    this.pool.remote.handleUploadedFile(mediaId).catch(
      async (e: Error): Promise<void> => {
        try {
          if (attempt == BACKOFF_DELAYS.length) {
            let db = await Services.database;
            let user = await db.getUserForMedia(mediaId);

            let userDb = (await Services.database).forUser(user.email);
            let [media] = await userDb.getMedia([mediaId]);

            this.logger.info({
              email: user.email,
              error: String(e),
            }, "Emailing user about failed process.");

            let email = await Services.email;
            await email.sendMessage({
              to: `${user.fullname} <${user.email}>`,
              subject: "Error processing media",
              content: `Hey ${user.fullname},

Some media that you recently uploaded couldn't be correctly processed. We tried ${attempt + 1} ` +
`times with no luck. Please see if the most recent error message makes any sense to you:

${e.stack}`,
            });

            if (!media) {
              return;
            }

            let storage = await (await Services.storage).getStorage(media.catalog);
            await storage.get().deleteUploadedFile(mediaId);
          } else {
            let scheduler = await Services.scheduler;
            scheduler.schedule(`reprocess-${mediaId}`, BACKOFF_DELAYS[attempt], () => {
              this.handleUploadedFile(mediaId, attempt + 1);
            });
          }
        } catch (e) {
          logger.error(e);
        }
      },
    );
  }

  public purgeDeletedMedia(): void {
    this.pool.remote.purgeDeletedMedia().catch(() => {
      // Error will have been logged in the task process.
    });
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
    database: config.database,
    logging: config.logging,
    storage: config.storage,
  });
}
