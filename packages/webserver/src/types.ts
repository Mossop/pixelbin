import net from "net";

export interface WebserverConfig {
  staticRoot: string;
  appRoot: string;
}

export interface MasterInterface {
  getServer: () => net.Server;
  getConfig: () => WebserverConfig;
}
