import { SendHandle } from "child_process";

import { getLogger } from "pixelbin-utils";

import Channel, { RemoteInterface, ChannelOptions } from "./channel";
import * as IPC from "./ipc";

export type AbstractProcess = Pick<NodeJS.Process, "send" | "on" | "off" | "disconnect">;

export interface MasterProcessOptions<L> extends ChannelOptions<L> {
  process?: AbstractProcess;
}

const logger = getLogger("worker.master");

/**
 * Provides a communication mechanism back to the main process.
 */

export class MasterProcess<R = undefined, L = undefined> {
  private channel: Channel<R, L>;
  private process: AbstractProcess;
  private disconnected: boolean;

  public constructor(options: MasterProcessOptions<L> = {}) {
    this.disconnected = false;
    this.process = options.process ?? process;
    if (!process.send) {
      throw new Error("Provided process instance has no IPC channel.");
    }

    this.process.on("message", this.onMessage);
    this.process.on("disconnect", this.onDisconnect);
    this.process.on("error", this.onError);

    this.channel = Channel.create<R, L>(
      (message: unknown, handle: undefined | SendHandle): Promise<void> => {
        if (this.disconnected) {
          return Promise.resolve();
        }

        return this.send({
          type: "rpc",
          message,
        }, handle);
      },
      options,
    );

    logger.trace("Signalling worker ready.");
    void this.send({
      type: "ready",
    });
  }

  public get remote(): Promise<RemoteInterface<R>> {
    return this.channel.remote;
  }

  private onMessage: NodeJS.MessageListener = (message: unknown, sendHandle: unknown): void => {
    let decoded = IPC.RPCDecoder.decode(message);
    if (decoded.isOk()) {
      switch (decoded.value.type) {
        case "rpc": {
          this.channel.onMessage(decoded.value.message, sendHandle);
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

  private send(message: IPC.Ready | IPC.RPC, handle?: undefined | SendHandle): Promise<void> {
    if (this.disconnected) {
      return Promise.reject(new Error("Worker has disconnected."));
    }

    return new Promise((resolve: () => void, reject: (error: Error) => void): void => {
      if (!this.process.send) {
        reject(new Error("Process has no IPC channel."));
        return;
      }

      this.process.send(message, handle, undefined, (error: Error | null): void => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
