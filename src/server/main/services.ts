import { defer, buildServices, serviceProvider } from "../../utils";
import type { DatabaseConnection } from "../database";
import type { StorageService } from "../storage";
import type { ServerConfig } from "./config";
import type { TaskManager } from "./tasks";
import type { WebserverManager } from "./webserver";

const services = {
  config: defer<ServerConfig>(),
  storage: defer<StorageService>(),
  database: defer<DatabaseConnection>(),
  taskManager: defer<TaskManager>(),
  webServers: defer<WebserverManager>(),
};

export const provideService = serviceProvider(services);

export default buildServices(services);
