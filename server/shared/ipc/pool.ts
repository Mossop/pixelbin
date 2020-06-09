import { WorkerProcess, WorkerProcessOptions } from "./worker";

export interface WorkerPoolOptions extends Partial<WorkerProcessOptions> {
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number;
}

interface WorkerRecord {
  worker: WorkerProcess;
  taskCount: number;
  idleTimeout?: NodeJS.Timeout;
}

export class WorkerPool {
  private workers: WorkerRecord[];
  private options: WorkerPoolOptions;
  private quitting: boolean;

  public constructor(
    options: Partial<WorkerPoolOptions>,
  ) {
    this.quitting = false;
    this.workers = [];
    this.options = Object.assign({
      minWorkers: 0,
      maxWorkers: 5,
      idleTimeout: 60 * 1000,
    }, options);

    if (this.options.maxWorkers < 1) {
      throw new Error("Cannot create a worker pool that allows no workers.");
    }

    this.ensureTargetWorkers();
  }

  public quit(): void {
    if (this.quitting) {
      return;
    }

    console.log(process.pid, "Quitting worker pool.");

    this.quitting = true;
    for (let record of this.workers) {
      void record.worker.kill();
    }

    this.workers = [];
  }

  public getWorker(): WorkerProcess {
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

  private createWorker(): WorkerProcess {
    console.log(process.pid, "Creating new worker.");

    let workerProcess = new WorkerProcess(this.options);

    let record: WorkerRecord = {
      worker: workerProcess,
      taskCount: 1,
    };

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
            console.log(process.pid, `Shutting down worker ${workerProcess.pid} due to timeout.`);
            void workerProcess.kill();
          }
        }, this.options.idleTimeout);
      }
    };

    this.workers.push(record);

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
      console.log(process.pid, `Saw disconnect from worker ${workerProcess.pid}.`);
      let pos = this.workers.indexOf(record);
      if (pos < 0) {
        return;
      }

      this.workers.splice(pos, 1);

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
      this.createWorker();
    }
  }
}
