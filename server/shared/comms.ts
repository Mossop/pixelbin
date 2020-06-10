import { RemotableInterface } from "./ipc/meta";

export interface ServerInterface extends RemotableInterface {
  serve: () => void;
}

export interface MasterInterface extends RemotableInterface {
}
