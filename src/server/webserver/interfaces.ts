import net from "net";

import { LogConfig } from "../../utils";
import { DatabaseConfig } from "../database";
import { StorageConfig } from "../storage";
import { TaskWorkerInterface } from "../task-worker/interfaces";

export interface WebserverConfig {
  staticRoot: string;
  appRoot: string;
  databaseConfig: DatabaseConfig;
  logConfig: LogConfig;
  storageConfig: StorageConfig;
  secretKeys: string[];
}

export type ParentProcessInterface = TaskWorkerInterface & {
  getServer: () => net.Server;
  getConfig: () => WebserverConfig;
};
