import child_process from "child_process";
import net from "net";
import path from "path";

import { getLogger, listen, bound } from "../../utils";
import type { WebserverConfig, ParentProcessInterface } from "../webserver/interfaces";
import type { AbstractChildProcess } from "../worker";
import { WorkerPool } from "../worker";
import { quit } from "./events";
import { Service } from "./service";
import Services from "./services";
import type { TaskManager } from "./tasks";

export type WebConfig = WebserverConfig & {
  webserverPackage: string;
};

const logger = getLogger("webserver-manager");

export class WebserverManager extends Service {
  private readonly server: net.Server;
  private readonly pool: WorkerPool<undefined, ParentProcessInterface>;

  public constructor(
    private readonly config: WebConfig,
    private readonly taskManager: TaskManager,
  ) {
    super(logger);
    this.server = net.createServer();
    this.logger.catch(listen(this.server, 8000).then((): void => {
      let address = this.server.address();
      if (address) {
        if (typeof address != "string") {
          address = `${address.address}:${address.port}`;
        }
      }
      logger.info(`Listening on http://${address}`);
    }));

    this.pool = new WorkerPool<undefined, ParentProcessInterface>({
      localInterface: bound(this.interface, this),
      minWorkers: 4,
      maxWorkers: 8,
      logger,
      fork: async (): Promise<AbstractChildProcess> => {
        logger.trace("Forking new process.");
        return child_process.fork(config.webserverPackage, [], {
          serialization: "advanced",
        });
      },
    });

    this.pool.on("shutdown", quit);
  }

  protected async shutdown(): Promise<void> {
    this.server.close();
    this.pool.shutdown();
  }

  // ParentProcessInterface
  private interface: ParentProcessInterface = {
    getServer(this: WebserverManager): net.Server {
      return this.server;
    },

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

export async function initWebserver(): Promise<WebserverManager> {
  let config = await Services.config;

  return new WebserverManager({
    htmlTemplate: path.join(config.htmlTemplate),
    webserverPackage: config.webserverPackage,
    staticRoot: path.join(config.staticRoot),
    appRoot: path.join(config.clientRoot),
    database: config.database,
    logging: config.logging,
    storage: config.storage,
    cache: config.cache,
    secretKeys: ["Random secret"],
  }, await Services.taskManager);
}
