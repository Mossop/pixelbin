import {
  safeDefer,
  buildServices,
  serviceProvider,
  serviceBuilderWrapper,
  getLogger,
} from "../../utils";
import Scheduler from "../../utils/scheduler";
import { DatabaseConnection } from "../database";
import { Emailer } from "../email";
import { StorageService } from "../storage";
import type { ServerConfig } from "./config";
import events from "./events";
import { TaskManager } from "./tasks";
import { WebserverManager } from "./webserver";

const services = {
  config: safeDefer<ServerConfig>(),
  storage: safeDefer<StorageService>(),
  database: safeDefer<DatabaseConnection>(),
  taskManager: safeDefer<TaskManager>(),
  webServers: safeDefer<WebserverManager>(),
  scheduler: safeDefer<Scheduler>(),
  email: safeDefer<Emailer>(),
};

export const provideService = serviceProvider(services);

export const serviceBuilder = serviceBuilderWrapper(services);

const Services = buildServices(services);
export default Services;

const logger = getLogger("pixelbin");

export const initDatabase = serviceBuilder(
  "database",
  async function initDatabase(): Promise<DatabaseConnection> {
    let config = await Services.config;

    let dbConnection = await DatabaseConnection.connect("main", config.database);
    await dbConnection.migrate();

    events.on("shutdown", () => {
      logger.catch(dbConnection.destroy());
    });

    return dbConnection;
  },
);

export const initStorage = serviceBuilder(
  "storage",
  async function initStorage(): Promise<StorageService> {
    let config = await Services.config;
    return new StorageService(config.storage, await Services.database);
  },
);

export const initEmail = serviceBuilder(
  "email",
  async function initEmail(): Promise<Emailer> {
    let config = await Services.config;
    return new Emailer(config.smtp);
  },
);

export const initTaskManager = serviceBuilder(
  "taskManager",
  async function initTaskManager(): Promise<TaskManager> {
    let config = await Services.config;
    return new TaskManager({
      database: config.database,
      logging: config.logging,
      storage: config.storage,
    });
  },
);

export const initWebserver = serviceBuilder(
  "webServers",
  async function initWebserver(): Promise<WebserverManager> {
    let config = await Services.config;

    return new WebserverManager({
      database: config.database,
      logging: config.logging,
      storage: config.storage,
      cache: config.cache,
      secretKeys: ["Random secret"],
    }, await Services.taskManager);
  },
);

export const initScheduler = serviceBuilder(
  "scheduler",
  (): Scheduler => new Scheduler(),
);
