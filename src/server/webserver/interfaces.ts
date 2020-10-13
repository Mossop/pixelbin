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

export interface ParentProcessInterface {
  getServer: () => net.Server;
  getConfig: () => WebserverConfig;
  handleUploadedFile: (media: string) => boolean;
}
