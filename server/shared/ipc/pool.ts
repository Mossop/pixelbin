import getLogger from "../logging";
import { MakeRequired } from "../utility";
import { RemoteInterface } from "./channel";
import { WorkerProcess, WorkerProcessOptions, AbstractChildProcess } from "./worker";

export interface WorkerPoolOptions<L> extends Omit<WorkerProcessOptions<L>, "process"> {
  fork: () => Promise<AbstractChildProcess>;
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeout?: number;
}

interface WorkerRecord<R, L> {
  worker: WorkerProcess<R, L>;
  taskCount: number;
  idleTimeout?: NodeJS.Timeout;
}

const logger = getLogger({
  name: "WorkerPool",
  level: "trace",
});

export class WorkerPool<R = undefined, L = undefined> {
  private workers: WorkerRecord<R, L>[];
  private options: MakeRequired<WorkerPoolOptions<L>, "minWorkers" | "maxWorkers" | "idleTimeout">;
  private quitting: boolean;

  public constructor(
    options: WorkerPoolOptions<L>,
  ) {
    this.quitting = false;
    this.workers = [];
    this.options = Object.assign({
      minWorkers: 0,
      maxWorkers: options.minWorkers ? Math.max(1, options.minWorkers) * 2 : 5,
      idleTimeout: 60 * 1000,
    }, options);

    if (this.options.maxWorkers < 1) {
      throw new Error("Cannot create a worker pool that allows no workers.");
    }

    if (this.options.maxWorkers < this.options.minWorkers) {
      throw new Error(
        "Cannot create a worker pool that allows less than the minimum number of workers.",
      );
    }

    logger.debug({
      minWorkers: this.options.minWorkers,
      maxWorkers: this.options.maxWorkers,
    }, "Created worker pool.");
    this.ensureTargetWorkers();
  }

  public shutdown(): void {
    if (this.quitting) {
      return;
    }

    logger.info("Shutting down worker pool.");

    this.quitting = true;
    for (let record of this.workers) {
      void record.worker.kill();
    }
  }

  public get remote(): Promise<RemoteInterface<R>> {
    return this.getWorker().then(
      (worker: WorkerProcess<R, L>): Promise<RemoteInterface<R>> => worker.remote,
    );
  }

  public async getWorker(): Promise<WorkerProcess<R, L>> {
    if (this.quitting) {
      throw new Error("Cannot get a new worker while the pool is quitting.");
    }

    if (!this.workers.length) {
      return this.createWorker();
    }

    // Generate a list of all the workers with the minimum number of running tasks.
    let min = [this.workers[0]];
    for (let i = 1; i < this.workers.length; i++) {
      if (min[0].taskCount > this.workers[i].taskCount) {
        min = [this.workers[i]];
      } else if (min[0].taskCount == this.workers[i].taskCount) {
        min.push(this.workers[i]);
      }
    }

    if (min[0].taskCount > 0 && this.workers.length < this.options.maxWorkers) {
      return this.createWorker();
    }

    return min[Math.floor(Math.random() * min.length)].worker;
  }

  private async createWorker(): Promise<WorkerProcess<R, L>> {
    logger.info("Creating new worker.");

    let workerProcess = new WorkerProcess<R, L>({
      ...this.options,
      process: await this.options.fork(),
    });

    let record: WorkerRecord<R, L> = {
      worker: workerProcess,
      taskCount: 1,
    };

    this.workers.push(record);

    const updateTaskCount = (delta: number): void => {
      if (record.idleTimeout) {
        clearTimeout(record.idleTimeout);
        delete record.idleTimeout;
      }

      record.taskCount += delta;

      if (record.taskCount == 0) {
        record.idleTimeout = setTimeout((): void => {
          delete record.idleTimeout;
          if (this.workers.length > this.options.minWorkers) {
            logger.info(`Shutting down worker ${workerProcess.pid} due to timeout.`);
            void workerProcess.kill();
          }
        }, this.options.idleTimeout);
      }
    };

    workerProcess.on("connect", (): void => {
      updateTaskCount(-1);
    });

    workerProcess.on("task-start", (): void => {
      updateTaskCount(1);
    });

    workerProcess.on("task-end", (): void => {
      updateTaskCount(-1);
    });

    workerProcess.on("task-fail", (): void => {
      updateTaskCount(-1);
    });

    workerProcess.on("disconnect", (): void => {
      let pos = this.workers.indexOf(record);
      if (pos < 0) {
        logger.warn("Received disconnect from an already disconnected worker.");
        return;
      }

      this.workers.splice(pos, 1);
      logger.info({ workerCount: this.workers.length }, "Saw disconnect from worker.");

      if (record.idleTimeout) {
        clearTimeout(record.idleTimeout);
        delete record.idleTimeout;
      }

      this.ensureTargetWorkers();
    });

    return workerProcess;
  }

  private ensureTargetWorkers(): void {
    if (this.quitting) {
      return;
    }

    let count = this.options.minWorkers;
    for (let i = this.workers.length; i < count; i++) {
      void this.createWorker();
    }
  }
}
