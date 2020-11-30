import child_process from "child_process";
import path from "path";

import { CURRENT_PROCESS_VERSION } from "../../model";
import type { MakeRequired } from "../../utils";
import { runTasks, getLogger, bound } from "../../utils";
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

export type TaskConfig = TaskWorkerConfig & {
  minWorkers?: number;
  maxWorkers?: number;
  maxTasksPerWorker?: number;
};

const logger = getLogger("task-pool");

type WorkerCountField = "minWorkers" | "maxWorkers" | "maxTasksPerWorker";
export class TaskManager extends Service {
  private readonly pool: WorkerPool<TaskWorkerInterface, ParentProcessInterface>;
  private readonly config: MakeRequired<TaskConfig, WorkerCountField>;

  public constructor(config: TaskConfig) {
    super(logger);
    this.config = {
      ...config,
      minWorkers: config.minWorkers ?? 0,
      maxWorkers: config.maxTasksPerWorker ?? 4,
      maxTasksPerWorker: config.maxTasksPerWorker ?? 3,
    };

    let module = path.resolve(path.join(path.dirname(__dirname), "task-worker"));

    this.pool = new WorkerPool<TaskWorkerInterface, ParentProcessInterface>({
      localInterface: bound(this.interface, this),
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxTasksPerWorker,
      maxTasksPerWorker: this.config.maxTasksPerWorker,
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
        } catch (error) {
          logger.error({ error });
        }
      },
    );
  }

  public purgeDeletedMedia(): Promise<void> {
    return this.pool.remote.purgeDeletedMedia().catch(() => {
      // Error will have been logged in the task process.
    });
  }

  public async updateOldMedia(): Promise<void> {
    let db = await Services.database;
    let outdated = await db.getOldMedia();
    if (outdated.length == 0) {
      return;
    }

    logger.info(`Updating ${outdated.length} media files to version ${CURRENT_PROCESS_VERSION}`);
    let maxTasks = Math.max(1, this.config.maxWorkers * this.config.maxTasksPerWorker / 2);

    await runTasks(maxTasks, (): Promise<void> | null => {
      let media = outdated.shift();
      if (media) {
        return this.pool.remote.reprocess(media).catch(() => {
          // Error will have been logged in the task process.
        });
      }
      return null;
    });
  }

  // ParentProcessInterface
  private interface: ParentProcessInterface = {
    getConfig(this: TaskManager): TaskWorkerConfig {
      return this.config;
    },
  };
}
