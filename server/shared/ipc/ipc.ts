import { JsonDecoder } from "ts.data.json";

export interface Ready {
  type: "ready";
}
export const ReadyDecoder = JsonDecoder.object<Ready>({
  type: JsonDecoder.isExactly("ready"),
}, "IPC.Ready");

export interface RPC {
  type: "rpc";
  channel: string;
  message: unknown;
}
export const RPCDecoder = JsonDecoder.object<RPC>({
  type: JsonDecoder.isExactly("rpc"),
  channel: JsonDecoder.string,
  message: JsonDecoder.succeed,
}, "IPC.Ready");

export const MessageDecoder = JsonDecoder.oneOf<Ready | RPC>([
  ReadyDecoder,
  RPCDecoder,
], "IPC");
