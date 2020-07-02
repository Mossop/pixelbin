import net from "net";

import { LogConfig } from "../../utils";
import { DatabaseConfig } from "../database";
import { StorageConfig } from "../storage";

export interface WebserverConfig {
  staticRoot: string;
  appRoot: string;
  databaseConfig: DatabaseConfig;
  logConfig: LogConfig;
  storageConfig: StorageConfig;
  secretKeys: string[];
}

export interface MasterInterface {
  getServer: () => net.Server;
  getConfig: () => WebserverConfig;
  handleUploadedFile: (id: string) => void;
}
