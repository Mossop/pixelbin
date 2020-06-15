import net from "net";

export interface ServerConfig {
  staticRoot: string;
  appRoot: string;
}

export interface ServerMasterInterface {
  getServer: () => net.Server;
  getConfig: () => ServerConfig;
}
