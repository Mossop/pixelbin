import { ChildProcess, SendHandle, Serializable } from "child_process";
import { EventEmitter } from "events";
import { clearTimeout } from "timers";

import { defer, Deferred, getLogger, Logger } from "../utils";
import Channel, { ChannelOptions, RemoteInterface } from "./channel";
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

const logger = getLogger("worker.child");

export class WorkerProcess<R = undefined, L = undefined> {
  private ready: Deferred<void>;
  private channel: Deferred<Channel<R, L>>;
  private emitter: EventEmitter;
  private disconnected: boolean;
  private logger: Logger;

  public constructor(
    private options: WorkerProcessOptions<L>,
  ) {
    this.logger = logger.child({ worker: options.process.pid });

    this.ready = defer();
    this.channel = defer();
    this.emitter = new EventEmitter();
    this.disconnected = false;

    this.options.process.on("message", this.onMessage);
    this.options.process.on("disconnect", this.onDisconnect);
    this.options.process.on("exit", this.onExit);
    this.options.process.on("error", this.onError);

    let connectTimeout = setTimeout((): void => {
      this.logger.error("Worker process timed out.");
      this.channel.reject(new Error("Worker process connection timed out."));
      this.shutdown();
    }, this.options.connectTimeout ?? 2000);

    this.emitter.once("connect", (): void => {
      clearTimeout(connectTimeout);
    });

    this.logger.trace("Created WorkerProcess.");
  }

  public get remote(): Promise<RemoteInterface<R>> {
    return this.channel.promise.then((channel: Channel<R, L>): Promise<RemoteInterface<R>> => {
      return channel.remote;
    });
  }

  public kill(...args: Parameters<ChildProcess["kill"]>): Promise<void> {
    this.logger.debug("Killing worker.");
    this.options.process.disconnect();

    return new Promise((resolve: () => void): void => {
      this.emitter.once("disconnect", resolve);
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
    }, this.options);

    channel.on("message-call", (): void => {
      this.emitter.emit("task-start");
    });
    channel.on("message-result", (): void => {
      this.emitter.emit("task-end");
    });
    channel.on("message-fail", (): void => {
      this.emitter.emit("task-fail");
    });
    channel.on("message-timeout", (): void => {
      this.shutdown();
    });
    channel.on("connection-timeout", (): void => {
      this.shutdown();
    });
    channel.on("close", (): void => {
      this.shutdown();
    });

    this.emitter.on("disconnect", (): void => {
      channel.close();
    });

    this.channel.resolve(channel);

    // Wait for channel to connect.
    await channel.remote;
    this.logger.debug("Worker channel connected.");
    this.emitter.emit("connect");
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

    this.emitter.emit("disconnect");
  }

  public get pid(): number {
    return this.options.process.pid;
  }

  public on(type: "connect", callback: () => void): void;
  public on(type: "task-start", callback: () => void): void;
  public on(type: "task-end", callback: () => void): void;
  public on(type: "task-fail", callback: () => void): void;
  public on(type: "disconnect", callback: () => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(type: string, callback: (...args: any[]) => void): void {
    this.emitter.on(type, callback);
  }

  public once(type: "connect", callback: () => void): void;
  public once(type: "task-start", callback: () => void): void;
  public once(type: "task-end", callback: () => void): void;
  public once(type: "task-fail", callback: () => void): void;
  public once(type: "disconnect", callback: () => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public once(type: string, callback: (...args: any[]) => void): void {
    this.emitter.once(type, callback);
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
