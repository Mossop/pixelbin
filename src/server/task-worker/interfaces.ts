import { LogConfig } from "../../utils";
import { DatabaseConfig } from "../database";
import { StorageConfig } from "../storage";

export interface TaskWorkerConfig {
  databaseConfig: DatabaseConfig;
  logConfig: LogConfig;
  storageConfig: StorageConfig;
}

export interface ParentProcessInterface {
  getConfig: () => TaskWorkerConfig;
}

export interface TaskWorkerInterface {
  handleUploadedFile: (media: string) => void;
}
