import net from "net";

import { LogConfig } from "../../utils";
import { CacheConfig } from "../cache";
import { DatabaseConfig } from "../database";
import { StorageConfig } from "../storage";

export interface WebserverConfig {
  htmlTemplate: string;
  staticRoot: string;
  appRoot: string;
  database: DatabaseConfig;
  logging: LogConfig;
  storage: StorageConfig;
  cache: CacheConfig;
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
