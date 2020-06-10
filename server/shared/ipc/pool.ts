import pino from "pino";

import { RemotableInterface, IntoPromises } from "./meta";
import { WorkerProcess, WorkerProcessOptions, AbstractChildProcess } from "./worker";

export interface WorkerPoolOptions<
  R extends RemotableInterface,
  L extends RemotableInterface
> extends Omit<WorkerProcessOptions<R, L>, "process"> {
  fork: () => Promise<AbstractChildProcess>;
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeout?: number;
}

type Always<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

interface WorkerRecord<R extends RemotableInterface, L extends RemotableInterface> {
  worker: WorkerProcess<R, L>;
  taskCount: number;
  idleTimeout?: NodeJS.Timeout;
}

const logger = pino({
  name: "WorkerPool",
  level: "trace",
  base: {
    pid: process.pid,
  },
});

export class WorkerPool<R extends RemotableInterface, L extends RemotableInterface> {
  private workers: WorkerRecord<R, L>[];
  private options: Always<WorkerPoolOptions<R, L>, "minWorkers" | "maxWorkers" | "idleTimeout">;
  private quitting: boolean;

  public constructor(
    options: WorkerPoolOptions<R, L>,
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

  public quit(): void {
    if (this.quitting) {
      return;
    }

    logger.info("Quitting worker pool.");

    this.quitting = true;
    for (let record of this.workers) {
      void record.worker.kill();
    }
  }

  public get remote(): Promise<IntoPromises<R>> {
    return this.getWorker().then(
      (worker: WorkerProcess<R, L>): Promise<IntoPromises<R>> => worker.remote,
    );
  }

  public async getWorker(): Promise<WorkerProcess<R, L>> {
    if (this.quitting) {
      throw new Error("Cannot get a new worker while the pool is quitting.");
    }

    if (!this.workers.length) {
      return this.createWorker();
    }

    let min = this.workers[0];
    for (let i = 1; i < this.workers.length; i++) {
      if (min.taskCount > this.workers[i].taskCount) {
        min = this.workers[i];
      }
    }

    if (min.taskCount > 0 && this.workers.length < this.options.maxWorkers) {
      return this.createWorker();
    }

    return min.worker;
  }

  private async createWorker(): Promise<WorkerProcess<R, L>> {
    logger.info("Creating new worker.");

    let workerProcess = new WorkerProcess({
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
