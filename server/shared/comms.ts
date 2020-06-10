import net from "net";

export interface ServerMasterInterface {
  getServer: () => net.Server;
}
