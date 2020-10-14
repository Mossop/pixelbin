import { JsonDecoder } from "ts.data.json";

import { oneOf } from "../../utils";

export interface Ready {
  type: "ready";
}
export const ReadyDecoder = JsonDecoder.object<Ready>({
  type: JsonDecoder.isExactly("ready"),
}, "IPC.Ready");

export interface RPC {
  type: "rpc";
  message: unknown;
}
export const RPCDecoder = JsonDecoder.object<RPC>({
  type: JsonDecoder.isExactly("rpc"),
  message: JsonDecoder.succeed,
}, "IPC.Ready");

export const MessageDecoder = oneOf<Ready | RPC>([
  ReadyDecoder,
  RPCDecoder,
], "IPC");
