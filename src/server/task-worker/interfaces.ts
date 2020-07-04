import { LogConfig } from "../../utils";
import { DatabaseConfig } from "../database";
import { StorageConfig } from "../storage";

export interface TaskWorkerConfig {
  databaseConfig: DatabaseConfig;
  logConfig: LogConfig;
  storageConfig: StorageConfig;
}

export interface MasterInterface {
  getConfig: () => TaskWorkerConfig;
}

export interface TaskWorkerInterface {
  handleUploadedFile: (id: string) => void;
}
