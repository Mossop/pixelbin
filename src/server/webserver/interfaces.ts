import net from "net";

import { LogConfig } from "../../utils";
import { DatabaseConfig } from "../database";
import { StorageConfig } from "../storage";

export interface WebserverConfig {
  htmlTemplate: string;
  staticRoot: string;
  appRoot: string;
  databaseConfig: DatabaseConfig;
  logConfig: LogConfig;
  storageConfig: StorageConfig;
  secretKeys: string[];
}

export interface TaskWorkerInterface {
  canStartTask: () => boolean;
  handleUploadedFile: (media: string) => void;
}

export type ParentProcessInterface = TaskWorkerInterface & {
  getServer: () => net.Server;
  getConfig: () => WebserverConfig;
};

export interface Session {
  user?: string | null;
}
