import type { SendHandle } from "child_process";
import net from "net";

import { JsonDecoder } from "ts.data.json";

import type { Deferred, Logger, MakeRequired } from "../../utils";
import { defer, getLogger, oneOf, TypedEmitter } from "../../utils";

const logger = getLogger("channel");

type MakePromise<T> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Promise<any>
    ? T
    // Unsure why this case is needed.
    : T extends boolean
      ? Promise<boolean>
      : Promise<T>;

export type RemoteInterface<T> = T extends undefined
  ? undefined
  : {
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
  methods: oneOf<string[] | undefined>([
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
  methods: oneOf<string[] | undefined>([
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
  handleArgument: number | null;
}
const RemoteCallDecoder = JsonDecoder.object<RemoteCall>({
  type: JsonDecoder.isExactly("call"),
  id: JsonDecoder.string,
  method: JsonDecoder.string,
  arguments: JsonDecoder.array(JsonDecoder.succeed, "arguments"),
  handleArgument: JsonDecoder.nullable(JsonDecoder.number),
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

const RemoteCallMessageDecoder = oneOf<RemoteCallMessage>([
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
  logger?: Logger;
}

interface EventMap {
  ["connection-timeout"]: [];
  close: [];
  ["message-timeout"]: [string];
  ["message-call"]: [string];
  ["message-fail"]: [string];
  ["message-result"]: [string];
}

export default class Channel<R = undefined, L = undefined> extends TypedEmitter<EventMap> {
  private nextId: number;
  private calls: Record<string, Call>;
  private closed: boolean;
  private remoteInterface: Deferred<RemoteInterface<R>>;
  private options: MakeRequired<ChannelOptions<L>, "timeout">;
  private logger: Logger;

  private constructor(
    private sendFn: (message: unknown, handle: undefined | SendHandle) => Promise<void>,
    options: ChannelOptions<L> = {},
  ) {
    super();
    this.nextId = 0;
    this.calls = {};
    this.closed = false;
    this.remoteInterface = defer();
    this.logger = options.logger ?? logger;

    this.options = Object.assign({
      timeout: 5000,
    }, options);
  }

  private buildRemoteInterface(methods: string[] | undefined): void {
    this.logger.trace({ methods }, "Remote reported methods.");
    if (methods == undefined) {
      // @ts-ignore
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
    let channelLogger = options.logger ?? logger;
    channelLogger.trace("Creating new channel.");

    let channel = new Channel<R, L>(send, options);

    let connectTimeout = setTimeout((): void => {
      channelLogger.error("Channel connection timed out.");
      channel.remoteInterface.reject(new Error("Channel connection timed out."));
      channel.emit("connection-timeout");
    }, channel.options.timeout);

    channelLogger.catch(channel.remoteInterface.promise.then((): void => {
      clearTimeout(connectTimeout);
    }, (): void => {
      channel.closed = true;
      channel.emit("close");
    }));

    return channel;
  }

  public static connect<R = undefined, L = undefined>(
    send: (message: unknown, handle?: net.Socket | net.Server) => Promise<void>,
    options: ChannelOptions<L> = {},
  ): Channel<R, L> {
    let channelLogger = options.logger ?? logger;
    channelLogger.trace("Connecting to channel.");

    let channel = new Channel<R, L>(send, options);
    channel.handshake();
    return channel;
  }

  private handshake(): void {
    this.logger.catch(this.send({
      type: "connect",
      methods: this.options.localInterface ? Object.keys(this.options.localInterface) : undefined,
    }));

    let connectTimeout = setTimeout((): void => {
      this.logger.error("Channel connection timed out.");
      this.remoteInterface.reject(new Error("Channel connection timed out."));
      this.emit("connection-timeout");
    }, this.options.timeout);

    this.logger.catch(this.remoteInterface.promise.then((): void => {
      clearTimeout(connectTimeout);
    }, (): void => {
      this.closed = true;
      this.emit("close");
    }));
  }

  public get remote(): Promise<RemoteInterface<R>> {
    return this.remoteInterface.promise;
  }

  private innerClose(): void {
    if (this.closed) {
      return;
    }

    this.logger.trace("Closing channel.");
    this.closed = true;
    this.emit("close");

    for (let call of Object.values(this.calls)) {
      call.reject(new Error("Channel to remote process closed before call returned."));
    }
    this.calls = {};
  }

  public close(): void {
    if (this.closed) {
      return;
    }

    this.logger.catch(this.send({
      type: "closed",
    }));

    this.innerClose();
  }

  public onMessage(message: unknown, handle: unknown): void {
    if (this.closed) {
      return;
    }

    let decoded = RemoteCallMessageDecoder.decode(message);

    if (decoded.isOk()) {
      this.logger.trace({ type: decoded.value.type }, "Message received.");

      switch (decoded.value.type) {
        case "call":
          this.logger.catch(this.localCall(decoded.value, handle));
          return;
        case "closed":
          this.innerClose();
          return;
        case "connect":
          this.logger.catch(this.send({
            type: "connected",
            methods: this.options.localInterface
              ? Object.keys(this.options.localInterface)
              : undefined,
          }));

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
            this.logger.trace("Got handle in response.");
          }
          call.resolve(handle ?? response.return);
          break;
      }
    } else {
      this.logger.error({
        error: decoded.error,
      }, "Received invalid message.");
    }
  }

  private async localCall(call: RemoteCall, handle: unknown): Promise<void> {
    let performCall = async (method: string, args: unknown[]): Promise<unknown> => {
      if (!this.options.localInterface) {
        throw new Error("This remote provides no interface.");
      }

      if (!(method in this.options.localInterface)) {
        this.logger.error({
          method,
        }, "Remote called an unknown method.");
        throw new Error(`Method ${method} does not exist.`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return this.options.localInterface[method](...args);
    };

    this.logger.catch(this.send({
      type: "ack",
      id: call.id,
    }));

    try {
      if (call.handleArgument !== null) {
        if (call.handleArgument < 0 || call.handleArgument >= call.arguments.length) {
          throw new Error(`Handle passed in unknown position (${call.handleArgument}).`);
        }
        if (!handle) {
          throw new Error("Missing expected handle.");
        }

        call.arguments[call.handleArgument] = handle;
      }

      let result = await performCall(call.method, call.arguments);

      if (result instanceof net.Socket || result instanceof net.Server) {
        this.logger.trace("Returning handle.");
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
        this.logger.error({ method: call.method }, "Failed to send response from method call.");
        this.close();
      }
    }
  }

  private send(message: RemoteCallMessage, handle?: net.Socket | net.Server): Promise<void> {
    this.logger.trace({ type: message.type }, "Sending message.");
    return this.sendFn(message, handle);
  }

  private async remoteCall(method: string, ...args: unknown[]): Promise<unknown> {
    if (this.closed) {
      throw new Error("Channel to remote process is closed.");
    }

    let handle: SendHandle | undefined = undefined;
    let handleArgument: null | number = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i] && (args[i] instanceof net.Socket || args[i] instanceof net.Server)) {
        if (handleArgument !== null) {
          throw new Error("Cannot pass multiple handle arguments.");
        }
        handleArgument = i;
        handle = args[i] as SendHandle;
        args[i] = null;
      }
    }

    let id = String(this.nextId++);

    let { promise, resolve, reject } = defer<unknown>();

    let call: Call = {
      resolve,
      reject,
      timeout: setTimeout((): void => {
        delete call.timeout;
        this.logger.error("Call to remote process timed out.");
        reject(new Error("Call to remote process timed out."));
        this.emit("message-timeout", method);
      }, this.options.timeout),
    };
    this.calls[id] = call;

    this.send({
      type: "call",
      id,
      method,
      arguments: args,
      handleArgument,
    }, handle).catch((error: Error): void => {
      reject(error);
    });

    this.emit("message-call", method);

    try {
      let result = await promise;
      this.emit("message-result", method);
      return result;
    } catch (e) {
      this.emit("message-fail", method);
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
