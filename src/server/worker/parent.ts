import { SendHandle, Serializable } from "child_process";
import { EventEmitter } from "events";

import { defer, getLogger, TypedEmitter, Deferred } from "../../utils";
import Channel, { RemoteInterface, ChannelOptions } from "./channel";
import * as IPC from "./ipc";

export type AbstractProcess = EventEmitter & {
  send: (
    message: Serializable,
    sendHandle: SendHandle | undefined,
    options: undefined,
    callback: (error: Error | null) => void,
  ) => void;
  disconnect: () => void;
};

export interface ParentProcessOptions<L> extends ChannelOptions<L> {
  process?: AbstractProcess;
}

function getProcess(): AbstractProcess {
  if (process.send) {
    // @ts-ignore: send cannot become undefined at runtime.
    return process;
  }
  throw new Error("Process has no IPC channel.");
}

const logger = getLogger("worker.parent");

/**
 * Provides a communication mechanism back to the main process.
 */

interface EventMap {
  disconnect: [];
}

export class ParentProcess<R = undefined, L = undefined> extends TypedEmitter<EventMap> {
  private channel: Channel<R, L>;
  private process: AbstractProcess;
  private disconnected: boolean;
  private channelRemote: Deferred<RemoteInterface<R>>;
  private parentRemote: RemoteInterface<R> | null;

  private constructor(options: ParentProcessOptions<L>) {
    super();
    this.disconnected = false;
    this.parentRemote = null;
    this.process = options.process ?? getProcess();
    this.channelRemote = defer();

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

    this.channel.remote.then((remote: RemoteInterface<R>): void => {
      this.channelRemote.resolve(remote);
    }, (error: unknown): void => {
      this.channelRemote.reject(error);
    });

    this.channel.on("connection-timeout", (): void => {
      this.shutdown();
    });

    this.channel.on("message-timeout", (): void => {
      this.shutdown();
    });

    logger.trace("Signalling worker ready.");
    logger.catch(this.send({
      type: "ready",
    }));
  }

  public static async connect<
    R = undefined,
    L = undefined,
  >(options: ParentProcessOptions<L> = {}): Promise<ParentProcess<R, L>> {
    let process = new ParentProcess<R, L>(options);
    process.parentRemote = await process.channelRemote.promise;
    return process;
  }

  public get remote(): RemoteInterface<R> {
    if (!this.parentRemote) {
      throw new Error("Illegal attempt to access remote before connected.");
    }
    return this.parentRemote;
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

    logger.trace("Worker shutdown");

    this.channel.close();
    this.disconnected = true;
    this.emit("disconnect");

    this.process.off("message", this.onMessage);
    this.process.off("disconnect", this.onDisconnect);
    this.process.off("error", this.onError);

    this.process.disconnect();
  }

  private onDisconnect: () => void = (): void => {
    logger.debug("Parent process disconnected.");
    this.shutdown();
  };

  private onError: (err: Error) => void = (err: Error): void => {
    logger.debug({ error: err }, "Saw error.");
    this.shutdown();
  };

  private send(message: IPC.Ready | IPC.RPC, handle?: undefined | SendHandle): Promise<void> {
    if (this.disconnected) {
      return Promise.reject(new Error("Worker has disconnected."));
    }

    return new Promise((resolve: () => void, reject: (error: Error) => void): void => {
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
