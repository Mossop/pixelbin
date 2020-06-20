import { SendHandle } from "child_process";
import { EventEmitter } from "events";
import net from "net";

import { defer, Deferred, getLogger, MakeRequired } from "pixelbin-utils";
import { JsonDecoder } from "ts.data.json";

const logger = getLogger("worker.channel");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MakePromise<T> = T extends Promise<any> ? T : Promise<T>;
export type RemoteInterface<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ?
    (...args: A) => MakePromise<R> :
    never;
};

interface RemoteConnect {
  type: "connect";
  methods: string[] | undefined;
}
const RemoteConnectDecoder = JsonDecoder.object<RemoteConnect>({
  type: JsonDecoder.isExactly("connect"),
  methods: JsonDecoder.oneOf<string[] | undefined>([
    JsonDecoder.isUndefined(undefined),
    JsonDecoder.array(JsonDecoder.string, "methods"),
  ], "string[] | undefined"),
}, "RemoteConnect");

interface RemoteConnected {
  type: "connected";
  methods: string[] | undefined;
}
const RemoteConnectedDecoder = JsonDecoder.object<RemoteConnected>({
  type: JsonDecoder.isExactly("connected"),
  methods: JsonDecoder.oneOf<string[] | undefined>([
    JsonDecoder.isUndefined(undefined),
    JsonDecoder.array(JsonDecoder.string, "methods"),
  ], "string[] | undefined"),
}, "RemoteConnected");

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
  arguments: unknown[];
}
const RemoteCallDecoder = JsonDecoder.object<RemoteCall>({
  type: JsonDecoder.isExactly("call"),
  id: JsonDecoder.string,
  method: JsonDecoder.string,
  arguments: JsonDecoder.array(JsonDecoder.succeed, "arguments"),
}, "RemoteCall");

interface RemoteCallAck {
  type: "ack";
  id: string;
}
const RemoteCallAckDecoder = JsonDecoder.object<RemoteCallAck>({
  type: JsonDecoder.isExactly("ack"),
  id: JsonDecoder.string,
}, "RemoteCallAck");

interface RemoteCallException {
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
  RemoteClosed | RemoteConnect | RemoteCall | RemoteCallAck |
  RemoteCallException | RemoteCallResult | RemoteConnected;

const RemoteCallMessageDecoder = JsonDecoder.oneOf<RemoteCallMessage>([
  RemoteConnectDecoder,
  RemoteConnectedDecoder,
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

export interface ChannelOptions<L> {
  localInterface?: L,
  timeout?: number;
}

export default class Channel<R = undefined, L = undefined> {
  private nextId: number;
  private calls: Record<string, Call>;
  private closed: boolean;
  private emitter: EventEmitter;
  private remoteInterface: Deferred<RemoteInterface<R>>;
  private options: MakeRequired<ChannelOptions<L>, "timeout">;

  private constructor(
    private sendFn: (message: unknown, handle: undefined | SendHandle) => Promise<void>,
    options: ChannelOptions<L> = {},
  ) {
    this.nextId = 0;
    this.calls = {};
    this.closed = false;
    this.emitter = new EventEmitter();
    this.remoteInterface = defer();

    this.options = Object.assign({
      timeout: 2000,
    }, options);
  }

  private buildRemoteInterface(methods: string[] | undefined): void {
    logger.trace({ methods }, "Remote reported methods.");
    if (methods == undefined) {
      this.remoteInterface.resolve(undefined);
      return;
    }

    let remote = {};
    for (let method of methods) {
      remote[method] = this.remoteCall.bind(this, method);
    }

    this.remoteInterface.resolve(remote as RemoteInterface<R>);
  }

  public static create<R = undefined, L = undefined>(
    send: (message: unknown, handle?: net.Socket | net.Server) => Promise<void>,
    options: ChannelOptions<L> = {},
  ): Channel<R, L> {
    logger.trace("Creating new channel.");

    return new Channel<R, L>(send, options);
  }

  public static connect<R = undefined, L = undefined>(
    send: (message: unknown, handle?: net.Socket | net.Server) => Promise<void>,
    options: ChannelOptions<L> = {},
  ): Channel<R, L> {
    logger.trace("Connecting to channel.");

    let channel = new Channel<R, L>(send, options);
    channel.handshake();
    return channel;
  }

  private handshake(): void {
    void this.send({
      type: "connect",
      methods: this.options.localInterface ? Object.keys(this.options.localInterface) : undefined,
    });

    let connectTimeout = setTimeout((): void => {
      logger.error("Channel connection timed out.");
      this.remoteInterface.reject(new Error("Channel connection timed out."));
      this.emitter.emit("connection-timeout");
    }, this.options.timeout);

    void this.remoteInterface.promise.then((): void => {
      clearTimeout(connectTimeout);
    }, (): void => {
      this.closed = true;
      this.emitter.emit("close");
    });
  }

  public on(type: "connection-timeout", listener: () => void): void;
  public on(type: "message-timeout", listener: () => void): void;
  public on(type: "message-call", listener: (method: string) => void): void;
  public on(type: "message-result", listener: (method: string) => void): void;
  public on(type: "message-fail", listener: (method: string) => void): void;
  public on(type: "close", listener: () => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(type: string, listener: (...args: any[]) => void): void {
    this.emitter.on(type, listener);
  }

  public get remote(): Promise<RemoteInterface<R>> {
    return this.remoteInterface.promise;
  }

  private innerClose(): void {
    if (this.closed) {
      return;
    }

    logger.trace("Closing channel.");
    this.closed = true;
    this.emitter.emit("close");

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

  public onMessage(message: unknown, handle: unknown): void {
    if (this.closed) {
      return;
    }

    let decoded = RemoteCallMessageDecoder.decode(message);

    if (decoded.isOk()) {
      logger.trace({ type: decoded.value.type }, "Message received.");

      switch (decoded.value.type) {
        case "call":
          void this.localCall(decoded.value);
          return;
        case "closed":
          this.innerClose();
          return;
        case "connect":
          void this.send({
            type: "connected",
            methods: this.options.localInterface ?
              Object.keys(this.options.localInterface) :
              undefined,
          });

          this.buildRemoteInterface(decoded.value.methods);
          return;
        case "connected":
          this.buildRemoteInterface(decoded.value.methods);
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
          if (handle) {
            logger.trace("Got handle in response.");
          }
          call.resolve(handle ?? response.return);
          break;
      }
    } else {
      logger.error("Received invalid message: '%s'.", decoded.error);
    }
  }

  private async localCall(call: RemoteCall): Promise<void> {
    const performCall = async (method: string, args: unknown[]): Promise<unknown> => {
      if (!this.options.localInterface) {
        throw new Error("This remote provides no interface.");
      }

      if (!(method in this.options.localInterface)) {
        logger.error("Remote called an unknown method: %s.", method);
        throw new Error(`Method ${method} does not exist.`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return this.options.localInterface[method](...args);
    };

    void this.send({
      type: "ack",
      id: call.id,
    });

    try {
      let result = await performCall(call.method, call.arguments);

      if (result instanceof net.Socket || result instanceof net.Server) {
        logger.trace("Returning handle.");
        await this.send({
          type: "return",
          id: call.id,
          return: undefined,
        }, result);
      } else {
        await this.send({
          type: "return",
          id: call.id,
          return: result,
        });
      }
    } catch (error) {
      try {
        await this.send({
          type: "exception",
          id: call.id,
          error,
        });
      } catch (e) {
        logger.error({ method: call.method }, "Failed to send response from method call.");
        this.close();
      }
    }
  }

  private send(message: RemoteCallMessage, handle?: net.Socket | net.Server): Promise<void> {
    logger.trace({ type: message.type }, "Sending message.");
    return this.sendFn(message, handle);
  }

  private async remoteCall(method: string, ...args: unknown[]): Promise<unknown> {
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
        logger.error("Call to remote process timed out.");
        reject(new Error("Call to remote process timed out."));
        this.emitter.emit("message-timeout");
      }, this.options.timeout),
    };
    this.calls[id] = call;

    this.send({
      type: "call",
      id,
      method,
      arguments: args,
    }).catch((error: Error): void => {
      reject(error);
    });

    this.emitter.emit("message-call", method);

    try {
      let result = await promise;
      this.emitter.emit("message-result", method);
      return result;
    } catch (e) {
      this.emitter.emit("message-fail", method);
      throw e;
    } finally {
      if (call.timeout) {
        clearTimeout(call.timeout);
        delete call.timeout;
      }

      delete this.calls[id];
    }
  }
}
