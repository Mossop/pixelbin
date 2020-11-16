import type { MakeRequired, Logger, Deferred } from "../../utils";
import { getLogger, TypedEmitter, defer } from "../../utils";
import type { RemoteInterface } from "./channel";
import type { WorkerProcessOptions, AbstractChildProcess } from "./worker";
import { WorkerProcess } from "./worker";

export interface WorkerPoolOptions<L> extends Omit<WorkerProcessOptions<L>, "process"> {
  fork: () => Promise<AbstractChildProcess>;
  minWorkers?: number;
  maxWorkers?: number;
  maxTasksPerWorker?: number;
  idleTimeout?: number;
}

type RequiredOptions = "minWorkers" | "maxWorkers" | "idleTimeout";

interface WorkerRecord<R, L> {
  worker: WorkerProcess<R, L>;
  taskCount: number;
  idleTimeout?: NodeJS.Timeout;
}

const logger = getLogger("worker-pool");

const MAX_BAD_WORKERS = 5;

interface EventMap {
  shutdown: [];
  ["queue-length"]: [number];
}

interface Task {
  method: string;
  params: unknown[];
  deferred: Deferred<unknown>;
}

export class WorkerPool<R = undefined, L = undefined> extends TypedEmitter<EventMap> {
  private workers: WorkerRecord<R, L>[] = [];
  private options: MakeRequired<WorkerPoolOptions<L>, RequiredOptions>;
  private quitting = false;
  private taskCount = 0;
  private runningQueue = false;
  private queue: Task[] = [];
  private logger: Logger;
  public readonly remote: RemoteInterface<R>;

  public constructor(
    options: WorkerPoolOptions<L>,
  ) {
    super();
    this.options = Object.assign({
      minWorkers: 0,
      maxWorkers: options.minWorkers ? options.minWorkers * 2 : 5,
      idleTimeout: 60 * 1000,
    }, options);
    this.logger = options.logger ?? logger;

    if (this.options.maxWorkers < 1) {
      throw new Error("Cannot create a worker pool that allows no workers.");
    }

    if (this.options.maxWorkers < this.options.minWorkers) {
      throw new Error(
        "Cannot create a worker pool that allows less than the minimum number of workers.",
      );
    }

    this.remote = new Proxy<Partial<RemoteInterface<R>>>({}, {
      get: (target: Partial<RemoteInterface<R>>, property: string): unknown => {
        if (!(property in target)) {
          target[property] = (...args: unknown[]): Promise<unknown> => {
            return this.queueTask(property, args);
          };
        }

        return target[property];
      },
    }) as RemoteInterface<R>;

    this.logger.info({
      minWorkers: this.options.minWorkers,
      maxWorkers: this.options.maxWorkers,
    }, "Created worker pool.");
    this.ensureTargetWorkers();
  }

  public get runningTasks(): number {
    return this.taskCount;
  }

  public get queueLength(): number {
    return this.queue.length;
  }

  public get workerCount(): number {
    return this.workers.length;
  }

  public shutdown(): void {
    if (this.quitting) {
      return;
    }

    this.logger.info("Shutting down worker pool.");

    this.quitting = true;

    for (let task of this.queue) {
      task.deferred.reject(new Error("Worker pool has shutdown."));
    }
    this.queue = [];

    for (let record of this.workers.slice(0)) {
      this.logger.info({ worker: record.worker.pid }, "Shutting down worker.");
      this.logger.catch(record.worker.kill());
    }
    this.workers = [];

    this.emit("shutdown");
  }

  private get canRunTask(): boolean {
    if (this.quitting) {
      return false;
    }

    if (!this.options.maxTasksPerWorker) {
      return true;
    }

    return this.taskCount < this.options.maxWorkers * this.options.maxTasksPerWorker;
  }

  private runQueue(): void {
    if (this.runningQueue || !this.queue.length) {
      return;
    }

    this.runningQueue = true;

    let doQueue = async (): Promise<void> => {
      this.logger.trace({
        queueLength: this.queue.length,
        runningTasks: this.taskCount,
        workerCount: this.workers.length,
        maxWorkers: this.options.maxWorkers,
        maxTasksPerWorker: this.options.maxTasksPerWorker,
      }, "Queue start.");

      try {
        while (this.canRunTask && this.queue.length) {
          let worker = await this.getWorker();

          let task = this.queue.shift();
          if (!task) {
            return;
          }

          while (!worker.remote || !(task.method in worker.remote)) {
            task.deferred.reject(new Error(`Method '${task.method}' does not exist on remote.`));

            task = this.queue.shift();
            if (!task) {
              return;
            }
          }

          worker.remote[task.method](...task.params).then(
            task.deferred.resolve,
            task.deferred.reject,
          );

          this.logger.trace({
            method: task.method,
            queueLength: this.queue.length,
            runningTasks: this.taskCount,
            workerCount: this.workers.length,
            maxWorkers: this.options.maxWorkers,
            maxTasksPerWorker: this.options.maxTasksPerWorker,
          }, "Queue dispatch.");
        }
      } finally {
        this.runningQueue = false;

        this.logger.trace({
          queueLength: this.queue.length,
          runningTasks: this.taskCount,
          workerCount: this.workers.length,
          maxWorkers: this.options.maxWorkers,
          maxTasksPerWorker: this.options.maxTasksPerWorker,
        }, "Queue suspend.");

        this.emit("queue-length", this.queueLength);
      }
    };

    this.logger.catch(doQueue());
  }

  private queueTask(method: string, params: unknown[]): Promise<unknown> {
    if (this.quitting) {
      return Promise.reject(new Error("Worker pool has shutdown."));
    }

    this.logger.trace({
      method,
    }, "Queueing task.");

    let deferred = defer<unknown>();

    this.queue.push({ method, params, deferred });
    this.runQueue();

    return deferred.promise;
  }

  private async getWorker(): Promise<WorkerProcess<R, L>> {
    if (this.quitting) {
      throw new Error("Cannot get a new worker while the pool is quitting.");
    }

    if (!this.workers.length) {
      return this.createWorker();
    }

    // Find the index of the first worker with the lowest task count.
    let min = 0;
    for (let i = 1; i < this.workers.length; i++) {
      if (this.workers[min].taskCount > this.workers[i].taskCount) {
        min = i;
      }
    }

    if (this.workers[min].taskCount > 0 && this.workers.length < this.options.maxWorkers) {
      return this.createWorker();
    }

    // Move this record to the end of the array to make it less likely to be used next time.
    let [record] = this.workers.splice(min, 1);
    this.workers.push(record);

    return record.worker;
  }

  private async createWorker(): Promise<WorkerProcess<R, L>> {
    let workerProcess: WorkerProcess<R, L> | null = null;
    let badWorkerCount = 0;
    while (!workerProcess) {
      try {
        workerProcess = await WorkerProcess.attach<R, L>({
          ...this.options,
          logger: this.logger.child({
            name: "worker",
          }),
          process: await this.options.fork(),
        });
      } catch (e) {
        badWorkerCount++;

        this.logger.warn(e, "Failed to attach to worker process.");

        if (badWorkerCount >= MAX_BAD_WORKERS) {
          this.logger.error("Saw too many worker failures, shutting down pool.");
          this.shutdown();
          throw new Error("Saw too many worker failures, shutting down pool.");
        }
      }
    }

    let record: WorkerRecord<R, L> = {
      worker: workerProcess,
      taskCount: 0,
    };

    this.workers.push(record);

    this.logger.info({
      workerCount: this.workers.length,
      worker: workerProcess.pid,
    }, "Created new worker.");

    let markIdle = (): void => {
      record.idleTimeout = setTimeout((): void => {
        delete record.idleTimeout;
        if (this.workers.length > this.options.minWorkers) {
          this.logger.info({ worker: record.worker.pid }, "Shutting down worker due to timeout.");
          this.logger.catch(record.worker.kill());
        }
      }, this.options.idleTimeout);
    };
    markIdle();

    let updateTaskCount = (delta: number): void => {
      this.logger.trace({
        worker: record.worker.pid,
        hasTimeout: !!record.idleTimeout,
        taskCount: record.taskCount,
        delta,
      }, "updateTaskCount");
      if (record.idleTimeout) {
        clearTimeout(record.idleTimeout);
        delete record.idleTimeout;
      }

      record.taskCount += delta;
      this.taskCount += delta;
      this.runQueue();

      if (record.taskCount == 0) {
        markIdle();
      }
    };

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
        this.logger.warn("Received disconnect from an already disconnected worker.");
        return;
      }

      this.workers.splice(pos, 1);
      this.logger.debug({
        workerCount: this.workers.length,
        worker: record.worker.pid,
      }, "Saw disconnect from worker.");

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
      this.logger.catch(this.createWorker());
    }
  }
}
