import net from "net";

export interface ServerConfig {
  staticRoot: string;
}

export interface ServerMasterInterface {
  getServer: () => net.Server;
  getConfig: () => ServerConfig;
}
