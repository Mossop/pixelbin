import { LogConfig } from "../../utils";
import { DatabaseConfig } from "../database";
import { StorageConfig } from "../storage";

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
}
