import pino from "pino";

import * as IPC from "./ipc";
import { RemotableInterface, IntoPromises } from "./meta";
import { Channel, ChannelOptions } from "./rpc";

type Always<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

export type AbstractProcess = Pick<NodeJS.Process, "send" | "on" | "off" | "disconnect">;

interface MasterProcessOptions<
  R extends RemotableInterface,
  L extends RemotableInterface
> extends ChannelOptions<R, L> {
  process?: AbstractProcess;
}

const logger = pino({
  name: "MasterProcess",
  level: "trace",
  base: {
    pid: process.pid,
  },
});

/**
 * Provides a communication mechanism back to the main process.
 */

export class MasterProcess<R extends RemotableInterface, L extends RemotableInterface> {
  private channel: Channel<R, L>;
  private process: AbstractProcess;
  private disconnected: boolean;

  public constructor(options: MasterProcessOptions<R, L>) {
    this.disconnected = false;
    this.process = options.process ?? process;
    if (!process.send) {
      throw new Error("Provided process instance has no IPC channel.");
    }

    this.process.on("message", this.onMessage);
    this.process.on("disconnect", this.onDisconnect);
    this.process.on("error", this.onError);

    this.channel = Channel.create((message: unknown): Promise<void> => {
      if (this.disconnected) {
        return Promise.resolve();
      }

      return this.send({
        type: "rpc",
        message,
      });
    }, options);

    logger.trace("Signalling worker ready.");
    void this.send({
      type: "ready",
    });
  }

  public get remote(): Promise<IntoPromises<R>> {
    return this.channel.remote;
  }

  private onMessage: (message: unknown) => void = (message: unknown): void => {
    let decoded = IPC.RPCDecoder.decode(message);
    if (decoded.isOk()) {
      switch (decoded.value.type) {
        case "rpc": {
          this.channel.onMessage(decoded.value.message);
          break;
        }
      }
    } else {
      logger.error("Received invalid message: '%s'.", decoded.error);
    }
  };

  public shutdown(): void {
    if (this.disconnected) {
      return;
    }
    this.disconnected = true;

    logger.trace("Worker shutdown");

    this.channel.close();

    this.process.off("message", this.onMessage);
    this.process.off("disconnect", this.onDisconnect);
    this.process.off("error", this.onError);

    this.process.disconnect();
  }

  private onDisconnect: () => void = (): void => {
    logger.debug("Master process disconnected.");
    void this.shutdown();
  };

  private onError: (err: Error) => void = (err: Error): void => {
    logger.debug({ error: err }, "Saw error.");
    void this.shutdown();
  };

  private send(message: IPC.Ready | IPC.RPC): Promise<void> {
    if (this.disconnected) {
      return Promise.reject(new Error("Worker has disconnected."));
    }

    return new Promise((resolve: () => void, reject: (error: Error) => void): void => {
      if (!this.process.send) {
        reject(new Error("Process has no IPC channel."));
        return;
      }

      this.process.send(message, undefined, undefined, (error: Error | null): void => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
