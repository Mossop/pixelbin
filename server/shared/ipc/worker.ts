import cluster, { Worker } from "cluster";
import { EventEmitter } from "events";

import defer, { Deferred } from "../defer";
import * as IPC from "./ipc";

export interface WorkerProcessOptions {
  environment: Record<string, string>;
  timeout: number;
}

export class WorkerProcess {
  private ready: Deferred<void>;
  private emitter: EventEmitter;
  private worker: Worker;
  private options: WorkerProcessOptions;
  private busyCount: number;
  private disconnected: boolean;

  public constructor(
    options: Partial<WorkerProcessOptions>,
  ) {
    this.ready = defer();
    this.emitter = new EventEmitter();
    this.busyCount = 1;
    this.disconnected = false;

    this.options = Object.assign({
      environment: {},
      timeout: 2000,
    }, options);

    this.worker = cluster.fork(this.options.environment);

    this.worker.on("message", this.onMessage);
    this.worker.on("disconnect", this.onDisconnect);
    this.worker.on("exit", this.onExit);
    this.worker.on("error", this.onError);
  }

  public kill(signal?: string): Promise<void> {
    return new Promise((resolve: () => void): void => {
      this.emitter.once("disconnect", resolve);
      this.worker.kill(signal);
    });
  }

  public get taskCount(): number {
    return this.busyCount;
  }

  private updateBusyCount(delta: number): void {
    this.busyCount += delta;
    this.emitter.emit("taskCountChange");
  }

  private onMessage: (message: unknown) => void = (message: unknown): void => {
    let decoded = IPC.MessageDecoder.decode(message);
    if (decoded.isOk()) {
      switch (decoded.value.type) {
        case "ready":
          this.ready.resolve();
          this.updateBusyCount(-1);
          break;
        case "rpc":
          break;
      }
    }
  };

  private onDisconnect: () => void = (): void => {
    if (this.disconnected) {
      return;
    }

    console.log(`Worker ${this.pid} disconnected.`);
    this.shutdown();
  };

  private onExit: () => void = (): void => {
    if (this.disconnected) {
      return;
    }

    console.log(`Worker ${this.pid} exited.`);
    this.shutdown();
  };

  private onError: (err: Error) => void = (err: Error): void => {
    if (this.disconnected) {
      return;
    }

    console.log(`Worker ${this.pid} errored.`, err);
    this.shutdown();
  };

  private shutdown(): void {
    if (this.disconnected) {
      return;
    }

    this.disconnected = true;

    this.worker.off("message", this.onMessage);
    this.worker.off("disconnect", this.onDisconnect);
    this.worker.off("exit", this.onExit);
    this.worker.off("error", this.onError);

    this.emitter.emit("disconnect");
  }

  public get pid(): number {
    return this.worker.process.pid;
  }

  public on(type: "taskCountChange", callback: () => void): void;
  public on(type: "disconnect", callback: () => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(type: string, callback: (...args: any[]) => void): void {
    this.emitter.on(type, callback);
  }

  private async send(message: IPC.RPC): Promise<void> {
    await this.ready.promise;

    if (this.disconnected) {
      throw new Error("Worker has disconnected.");
    }

    return new Promise((resolve: () => void, reject: (error: Error) => void): void => {
      this.worker.send(message, undefined, (error: Error | null): void => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
