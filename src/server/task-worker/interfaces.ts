import type { LogConfig } from "../../utils";
import type { DatabaseConfig } from "../database";
import type { StorageConfig } from "../storage";

export interface TaskWorkerConfig {
  database: DatabaseConfig;
  logging: LogConfig;
  storage: StorageConfig;
}

export interface ParentProcessInterface {
  getConfig: () => TaskWorkerConfig;
}

export interface TaskWorkerInterface {
  handleUploadedFile: (media: string) => void;
  purgeDeletedMedia: () => void;
  reprocess: (media: string) => void;
}
