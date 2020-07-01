import net from "net";

import { LogConfig } from "../../utils";
import { DatabaseConfig } from "../database";

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
