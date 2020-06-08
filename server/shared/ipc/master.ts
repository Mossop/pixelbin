import cluster, { Worker } from "cluster";

import * as IPC from "./ipc";
import { Channel } from "./rpc";

/**
 * Provides a communication mechanism back to the main process.
 */

export class MasterProcess {
  private worker: Worker;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private channels: Record<string, Channel<any, any>>;

  public constructor() {
    this.worker = cluster.worker;
    this.channels = {};

    this.worker.on("message", this.onMessage);
    this.worker.on("disconnect", this.onDisconnect);
    this.worker.on("error", this.onError);

    this.send({
      type: "ready",
    });
    console.log(process.pid, "Worker process ready");
  }

  private onMessage: (message: unknown) => void = (message: unknown): void => {
    let decoded = IPC.RPCDecoder.decode(message);
    if (decoded.isOk()) {
      switch (decoded.value.type) {
        case "rpc": {
          break;
        }
      }
    }
  };

  public shutdown(): void {
    for (let channel of Object.values(this.channels)) {
      channel.close();
    }
    this.channels = {};

    this.worker.off("message", this.onMessage);
    this.worker.off("disconnect", this.onDisconnect);
    this.worker.off("error", this.onError);

    this.worker.disconnect();
  }

  private onDisconnect: () => void = (): void => {
    console.log(process.pid, "Disconnected from master.");
    void this.shutdown();
  };

  private onError: (err: Error) => void = (err: Error): void => {
    console.log(process.pid, "Worker saw error.", err);
    void this.shutdown();
  };

  private send(message: IPC.Ready | IPC.RPC): void {
    this.worker.send(message);
  }
}
