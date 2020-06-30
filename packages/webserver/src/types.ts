import net from "net";

import { DatabaseConfig } from "pixelbin-database";
import { LogConfig } from "pixelbin-utils";

export interface WebserverConfig {
  staticRoot: string;
  appRoot: string;
  database: DatabaseConfig;
  logConfig: LogConfig;
  secretKeys: string[];
  tempStorage: string;
  localStorage: string;
}

export interface MasterInterface {
  getServer: () => net.Server;
  getConfig: () => WebserverConfig;
}
