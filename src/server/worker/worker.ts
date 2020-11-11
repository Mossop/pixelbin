import type { ChildProcess, SendHandle, Serializable } from "child_process";
import type { EventEmitter } from "events";
import { clearTimeout } from "timers";

import type { Deferred, Logger } from "../../utils";
import { defer, getLogger, TypedEmitter } from "../../utils";
import type { ChannelOptions, RemoteInterface } from "./channel";
import Channel from "./channel";
import * as IPC from "./ipc";

export type AbstractChildProcess = EventEmitter & {
  send: (
    message: Serializable,
    sendHandle?: SendHandle,
    callback?: (error: Error | null) => void,
  ) => void;
  kill: (signal?: NodeJS.Signals | number) => boolean;
  pid: number;
  disconnect: () => void;
};

export interface WorkerProcessOptions<L> extends ChannelOptions<L> {
  connectTimeout?: number;
  process: AbstractChildProcess;
}

const logger = getLogger("worker-process");

interface EventMap {
  disconnect: [];
  ["task-start"]: [];
  ["task-end"]: [];
  ["task-fail"]: [];
}

export class WorkerProcess<R = undefined, L = undefined> extends TypedEmitter<EventMap> {
  private ready: Deferred<void>;
  private channel: Deferred<Channel<R, L>>;
  private disconnected: boolean;
  private logger: Logger;
  private workerRemote: RemoteInterface<R> | null;

  private constructor(
    private options: WorkerProcessOptions<L>,
  ) {
    super();
    this.logger = (options.logger ?? logger).child({ worker: options.process.pid });
    this.workerRemote = null;

    this.ready = defer();
    this.channel = defer();
    this.disconnected = false;

    this.options.process.on("message", this.onMessage);
    this.options.process.on("disconnect", this.onDisconnect);
    this.options.process.on("exit", this.onExit);
    this.options.process.on("error", this.onError);

    this.logger.trace("Created WorkerProcess.");
  }

  public static async attach<
    R = undefined,
    L = undefined,
  >(options: WorkerProcessOptions<L>): Promise<WorkerProcess<R, L>> {
    let process = new WorkerProcess<R, L>(options);

    let connectTimeout = setTimeout((): void => {
      process.logger.error("Worker process timed out.");
      process.channel.reject(new Error("Worker process connection timed out."));
    }, options.connectTimeout ?? 10000);

    let channel = await process.channel.promise;
    clearTimeout(connectTimeout);
    process.workerRemote = await channel.remote;

    return process;
  }

  public get remote(): RemoteInterface<R> {
    if (!this.workerRemote) {
      throw new Error("Illegal attempt to access remote before connected.");
    }

    return this.workerRemote;
  }

  public kill(...args: Parameters<ChildProcess["kill"]>): Promise<void> {
    this.logger.debug("Killing worker.");
    this.options.process.disconnect();

    return new Promise((resolve: () => void): void => {
      this.once("disconnect", resolve);
      this.options.process.kill(...args);
    });
  }

  private async buildChannel(): Promise<void> {
    let channel = Channel.connect<R, L>((message: unknown, handle?: SendHandle): Promise<void> => {
      if (this.disconnected) {
        return Promise.resolve();
      }

      return this.send({
        type: "rpc",
        message,
      }, handle);
    }, {
      ...this.options,
      logger: this.logger.child({
        name: "channel",
      }),
    });

    channel.on("message-call", (): void => {
      this.emit("task-start");
    });
    channel.on("message-result", (): void => {
      this.emit("task-end");
    });
    channel.on("message-fail", (): void => {
      this.emit("task-fail");
    });
    channel.on("message-timeout", (): void => {
      this.shutdown();
    });
    channel.on("close", (): void => {
      this.shutdown();
    });

    this.on("disconnect", (): void => {
      channel.close();
    });

    this.channel.resolve(channel);

    // Wait for channel to connect.
    await channel.remote;
    this.logger.debug("Worker channel connected.");
  }

  private onMessage: NodeJS.MessageListener = (message: unknown, handle: unknown): void => {
    let decoded = IPC.MessageDecoder.decode(message);
    if (decoded.isOk()) {
      this.logger.trace(decoded.value, "Saw message");
      switch (decoded.value.type) {
        case "ready":
          this.ready.resolve();
          logger.catch(this.buildChannel());
          break;
        case "rpc": {
          let rpcMessage = decoded.value.message;
          logger.catch(this.channel.promise.then((channel: Channel<R, L>): void => {
            channel.onMessage(rpcMessage, handle);
          }));
          break;
        }
      }
    } else {
      this.logger.error(decoded.error, "Received invalid message: '%s'.");
    }
  };

  private onDisconnect: () => void = (): void => {
    if (this.disconnected) {
      return;
    }

    this.logger.debug("Worker disconnected.");
    this.shutdown();
  };

  private onExit: () => void = (): void => {
    if (this.disconnected) {
      return;
    }

    this.logger.debug("Worker exited.");
    this.shutdown();
  };

  private onError: (err: Error) => void = (err: Error): void => {
    if (this.disconnected) {
      return;
    }

    this.logger.error({ error: err }, "Worker reported error.");
    this.shutdown();
  };

  private shutdown(): void {
    if (this.disconnected) {
      return;
    }

    this.logger.trace("Worker shutdown");

    this.disconnected = true;

    this.options.process.off("message", this.onMessage);
    this.options.process.off("disconnect", this.onDisconnect);
    this.options.process.off("exit", this.onExit);
    this.options.process.off("error", this.onError);

    this.emit("disconnect");
  }

  public get pid(): number {
    return this.options.process.pid;
  }

  private async send(message: IPC.RPC, handle?: SendHandle): Promise<void> {
    await this.ready.promise;

    if (this.disconnected) {
      throw new Error("Worker has disconnected.");
    }

    return new Promise((resolve: () => void, reject: (error: Error) => void): void => {
      this.options.process.send(message, handle, (error: Error | null): void => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
