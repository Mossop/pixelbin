import child_process from "child_process";
import net from "net";
import path from "path";

import { getLogger, bound } from "../../utils";
import type {
  WebserverConfig,
  ParentProcessInterface,
  WebserverInterface,
} from "../webserver/interfaces";
import type { AbstractChildProcess } from "../worker";
import { WorkerPool } from "../worker";
import { quit } from "./events";
import { Service } from "./service";
import type { TaskManager } from "./tasks";

export type WebConfig = WebserverConfig;

const logger = getLogger("pixelbin/webserver");

export class WebserverManager extends Service {
  private readonly server: net.Server;
  private readonly pool: WorkerPool<WebserverInterface, ParentProcessInterface>;

  public constructor(
    private readonly config: WebConfig,
    private readonly taskManager: TaskManager,
  ) {
    super(logger);

    let module = path.resolve(path.join(path.dirname(__dirname), "webserver"));

    this.pool = new WorkerPool<WebserverInterface, ParentProcessInterface>({
      localInterface: bound(this.interface, this),
      minWorkers: 4,
      maxWorkers: 8,
      logger,
      fork: async (): Promise<AbstractChildProcess> => {
        logger.trace("Forking new process.");
        return child_process.fork(module, [], {
          serialization: "advanced",
        });
      },
    });

    this.pool.on("shutdown", quit);

    this.server = net.createServer({
      pauseOnConnect: true,
    }, (socket: net.Socket): void => {
      this.pool.remote.handleConnection(socket)
        .catch((e: Error) => {
          logger.error(e, "Worker failed to handle connection.");
          socket.destroy(e);
        });
    });

    this.server.listen(8000, (): void => {
      let address = this.server.address();
      if (address) {
        if (typeof address != "string") {
          address = `${address.address}:${address.port}`;
        }
      }
      logger.info(`Listening on http://${address}`);
    });
  }

  protected async shutdown(): Promise<void> {
    this.server.close();
    this.pool.shutdown();
  }

  // ParentProcessInterface
  private interface: ParentProcessInterface = {
    getConfig(this: WebserverManager): WebserverConfig {
      return this.config;
    },

    canStartTask(this: WebserverManager): boolean {
      return this.taskManager.canStartTask();
    },

    handleUploadedFile(this: WebserverManager, id: string): void {
      return this.taskManager.handleUploadedFile(id);
    },
  };
}
