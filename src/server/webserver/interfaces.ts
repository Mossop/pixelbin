import type net from "net";

import type { LogConfig } from "../../utils";
import type { CacheConfig } from "../cache";
import type { DatabaseConfig } from "../database";
import type { StorageConfig } from "../storage";

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
  csrfToken?: string | null;
}
