import child_process from "child_process";
import net from "net";
import path from "path";

import { getLogger, listen, bound } from "../../utils";
import { WebserverConfig, ParentProcessInterface } from "../webserver/interfaces";
import { WorkerPool, AbstractChildProcess } from "../worker";
import { quit } from "./events";
import { Service } from "./service";
import services, { provideService } from "./services";
import { TaskManager } from "./tasks";

export type WebConfig = WebserverConfig & {
  webserverPackage: string;
};

const logger = getLogger("webserver-parent");

export class WebserverManager extends Service {
  private readonly server: net.Server;
  private readonly pool: WorkerPool<undefined, ParentProcessInterface>;

  private constructor(
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
      fork: async (): Promise<AbstractChildProcess> => {
        logger.trace("Forking new process.");
        return child_process.fork(config.webserverPackage, [], {
          serialization: "advanced",
        });
      },
    });

    this.pool.on("shutdown", quit);
  }

  public static async init(): Promise<void> {
    let config = await services.config;

    let webServers = new WebserverManager({
      htmlTemplate: path.join(config.htmlTemplate),
      webserverPackage: config.webserverPackage,
      staticRoot: path.join(config.staticRoot),
      appRoot: path.join(config.clientRoot),
      databaseConfig: config.database,
      secretKeys: ["Random secret"],
      logConfig: config.logConfig,
      storageConfig: config.storageConfig,
    }, await services.taskManager);

    provideService("webServers", webServers);
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

    handleUploadedFile(this: WebserverManager, id: string): boolean {
      return this.taskManager.handleUploadedFile(id);
    },
  };
}
