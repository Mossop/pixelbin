import net from "net";

import { RemotableInterface } from "./ipc/meta";

export interface ServerInterface extends RemotableInterface {
}

export interface ServerMasterInterface extends RemotableInterface {
  getServer: () => net.Server;
}
