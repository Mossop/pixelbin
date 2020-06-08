import { EventEmitter } from "events";

import { JsonDecoder } from "ts.data.json";

import defer from "../defer";
import { RemotableInterface, IntoPromises, ReturnDecodersFor, ArgDecodersFor } from "./meta";

interface RemoteClosed {
  type: "closed";
}
const RemoteClosedDecoder = JsonDecoder.object<RemoteClosed>({
  type: JsonDecoder.isExactly("closed"),
}, "RemoteClosed");

interface RemoteCall {
  type: "call";
  id: string;
  method: string;
  argument: unknown;
}
const RemoteCallDecoder = JsonDecoder.object<RemoteCall>({
  type: JsonDecoder.isExactly("call"),
  id: JsonDecoder.string,
  method: JsonDecoder.string,
  argument: JsonDecoder.succeed,
}, "RemoteCall");

interface RemoteCallAck {
  type: "ack";
  id: string;
}
const RemoteCallAckDecoder = JsonDecoder.object<RemoteCallAck>({
  type: JsonDecoder.isExactly("ack"),
  id: JsonDecoder.string,
}, "RemoteCallAck");

export interface RemoteCallException {
  type: "exception";
  id: string;
  error: unknown;
}
const RemoteCallExceptionDecoder = JsonDecoder.object<RemoteCallException>({
  type: JsonDecoder.isExactly("exception"),
  id: JsonDecoder.string,
  error: JsonDecoder.succeed,
}, "RemoteCallException");

interface RemoteCallResult {
  type: "return";
  id: string;
  return: unknown;
}
const RemoteCallResultDecoder = JsonDecoder.object<RemoteCallResult>({
  type: JsonDecoder.isExactly("return"),
  id: JsonDecoder.string,
  return: JsonDecoder.succeed,
}, "RemoteCallResult");

type RemoteCallMessage =
  RemoteClosed | RemoteCall | RemoteCallAck | RemoteCallException | RemoteCallResult;

const RemoteCallMessageDecoder = JsonDecoder.oneOf<RemoteCallMessage>([
  RemoteClosedDecoder,
  RemoteCallDecoder,
  RemoteCallAckDecoder,
  RemoteCallExceptionDecoder,
  RemoteCallResultDecoder,
], "RemoteCallMessage");

interface Call {
  resolve: (arg: unknown) => void;
  reject: (arg: unknown) => void;
  timeout?: NodeJS.Timeout;
}

export interface ChannelOptions<R extends RemotableInterface, L extends RemotableInterface> {
  timeout?: number;
  localInterface: L;
  requestDecoders: ArgDecodersFor<L>;
  responseDecoders: ReturnDecodersFor<R>;
}

export class Channel<R extends RemotableInterface, L extends RemotableInterface> {
  private nextId: number;
  private calls: Record<string, Call>;
  private closed: boolean;
  private send: (message: RemoteCallMessage) => Promise<void>;
  private emitter: EventEmitter;
  private remoteInterface: IntoPromises<R>;
  private options: Required<ChannelOptions<R, L>>;

  public constructor(
    send: (message: unknown) => Promise<void>,
    options: ChannelOptions<R, L>,
  ) {
    this.nextId = 0;
    this.calls = {};
    this.closed = false;
    this.send = send as (message: RemoteCallMessage) => Promise<void>;
    this.emitter = new EventEmitter();

    this.options = Object.assign({
      timeout: 2000,
    }, options);

    this.remoteInterface = new Proxy({}, {
      has(_target: unknown, property: string): boolean {
        return property != "then";
      },

      get: (_target: unknown, property: string): unknown => {
        if (property == "then") {
          return undefined;
        }

        return async (argument: unknown = undefined): Promise<unknown> => {
          let result = await this.remoteCall(property, argument);
          if (property in this.options.responseDecoders) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return this.options.responseDecoders[property](result);
          }

          return result;
        };
      },
    }) as IntoPromises<R>;
  }

  public once(type: "timeout", listener: () => void): void {
    this.emitter.once(type, listener);
  }

  public on(type: "timeout", listener: () => void): void;
  public on(type: "message-call", listener: (method: string) => void): void;
  public on(type: "message-result", listener: (method: string) => void): void;
  public on(type: "message-fail", listener: (method: string) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(type: string, listener: (...args: any[]) => void): void {
    this.emitter.on(type, listener);
  }

  public get remote(): Promise<IntoPromises<R>> {
    return Promise.resolve(this.remoteInterface);
  }

  private innerClose(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;

    for (let call of Object.values(this.calls)) {
      call.reject(new Error("Channel to remote process closed before call returned."));
    }
    this.calls = {};
  }

  public close(): void {
    if (this.closed) {
      return;
    }

    void this.send({
      type: "closed",
    });

    this.innerClose();
  }

  public onMessage(message: unknown): void {
    if (this.closed) {
      return;
    }

    let decoded = RemoteCallMessageDecoder.decode(message);

    if (decoded.isOk()) {
      switch (decoded.value.type) {
        case "call":
          this.localCall(decoded.value);
          return;
        case "closed":
          this.innerClose();
          return;
      }

      let response = decoded.value;

      if (!(response.id in this.calls)) {
        return;
      }

      let call = this.calls[response.id];
      switch (response.type) {
        case "ack":
          if (call.timeout) {
            clearTimeout(call.timeout);
            delete call.timeout;
          }
          return;
        case "exception":
          call.reject(response.error);
          break;
        case "return":
          call.resolve(response.return);
          break;
      }
    } else {
      throw new Error(decoded.error);
    }
  }

  private localCall(call: RemoteCall): void {
    const performCall = async (method: string, argument: unknown): Promise<unknown> => {
      if (!(method in this.options.localInterface)) {
        throw new Error(`Method ${method} does not exist.`);
      }

      if (method in this.options.requestDecoders) {
        let arg = await this.options.requestDecoders[method](argument);
        // @ts-ignore: TypeScript can't see the argument for some reason.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this.options.localInterface[method](arg);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return this.options.localInterface[method]();
    };

    void this.send({
      type: "ack",
      id: call.id,
    });

    performCall(call.method, call.argument).then((result: unknown): void => {
      void this.send({
        type: "return",
        id: call.id,
        return: result,
      });
    }, (error: unknown): void => {
      void this.send({
        type: "exception",
        id: call.id,
        error,
      });
    });
  }

  private async remoteCall(method: string, argument: unknown): Promise<unknown> {
    if (this.closed) {
      throw new Error("Channel to remote process is closed.");
    }

    let id = String(this.nextId++);

    let { promise, resolve, reject } = defer<unknown>();

    let call: Call = {
      resolve,
      reject,
      timeout: setTimeout((): void => {
        delete call.timeout;
        call.reject("Call to remote process timed out.");
        this.emitter.emit("timeout");
      }, 2000),
    };
    this.calls[id] = call;

    this.send({
      type: "call",
      id,
      method,
      argument,
    }).catch((error: Error): void => {
      call.reject(error);
    });

    this.emitter.emit("message-call", method);
    promise.then((): void => {
      this.emitter.emit("message-result", method);
    }, (): void => {
      this.emitter.emit("message-fail", method);
    }).finally((): void => {
      if (call.timeout) {
        clearTimeout(call.timeout);
        delete call.timeout;
      }

      delete this.calls[id];
    });

    return promise;
  }
}
