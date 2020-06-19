import net from "net";

import { DatabaseConfig } from "pixelbin-database";

export interface WebserverConfig {
  staticRoot: string;
  appRoot: string;
  database: DatabaseConfig;
  secretKeys: string[];
}

export interface MasterInterface {
  getServer: () => net.Server;
  getConfig: () => WebserverConfig;
}
