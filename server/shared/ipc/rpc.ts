import { EventEmitter } from "events";

import pino from "pino";
import { JsonDecoder } from "ts.data.json";

import defer, { Deferred } from "../defer";
import { RemotableInterface, IntoPromises, ReturnDecodersFor, ArgDecodersFor } from "./meta";

const logger = pino({
  name: "Channel",
  level: "debug",
  base: {
    pid: process.pid,
  },
});

interface RemoteConnect {
  type: "connect";
  methods: string[];
}
const RemoteConnectDecoder = JsonDecoder.object<RemoteConnect>({
  type: JsonDecoder.isExactly("connect"),
  methods: JsonDecoder.array(JsonDecoder.string, "methods"),
}, "RemoteConnect");

interface RemoteConnected {
  type: "connected";
  methods: string[];
}
const RemoteConnectedDecoder = JsonDecoder.object<RemoteConnected>({
  type: JsonDecoder.isExactly("connected"),
  methods: JsonDecoder.array(JsonDecoder.string, "methods"),
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
  private emitter: EventEmitter;
  private remoteInterface: Deferred<IntoPromises<R>>;
  private options: Required<ChannelOptions<R, L>>;

  private constructor(
    private sendFn: (message: unknown) => Promise<void>,
    options: ChannelOptions<R, L>,
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

  private buildRemoteInterface(methods: string[]): void {
    logger.trace({ methods }, "Remote reported methods.");
    let remote = {};
    for (let method of methods) {
      remote[method] = this.remoteCall.bind(this, method);
    }

    this.remoteInterface.resolve(remote as IntoPromises<R>);
  }

  public static create<R extends RemotableInterface, L extends RemotableInterface>(
    send: (message: unknown) => Promise<void>,
    options: ChannelOptions<R, L>,
  ): Channel<R, L> {
    logger.trace("Creating new channel.");

    return new Channel(send, options);
  }

  public static connect<R extends RemotableInterface, L extends RemotableInterface>(
    send: (message: unknown) => Promise<void>,
    options: ChannelOptions<R, L>,
  ): Channel<R, L> {
    logger.trace("Connecting to channel.");

    let channel = new Channel(send, options);
    channel.handshake();
    return channel;
  }

  private handshake(): void {
    void this.send({
      type: "connect",
      methods: Object.keys(this.options.localInterface),
    });
  }

  public on(type: "timeout", listener: () => void): void;
  public on(type: "message-call", listener: (method: string) => void): void;
  public on(type: "message-result", listener: (method: string) => void): void;
  public on(type: "message-fail", listener: (method: string) => void): void;
  public on(type: "close", listener: () => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(type: string, listener: (...args: any[]) => void): void {
    this.emitter.on(type, listener);
  }

  public get remote(): Promise<IntoPromises<R>> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

  public onMessage(message: unknown): void {
    if (this.closed) {
      return;
    }

    let decoded = RemoteCallMessageDecoder.decode(message);

    if (decoded.isOk()) {
      logger.trace({ type: decoded.value.type }, "Message received.");

      switch (decoded.value.type) {
        case "call":
          this.localCall(decoded.value);
          return;
        case "closed":
          this.innerClose();
          return;
        case "connect":
          void this.send({
            type: "connected",
            methods: Object.keys(this.options.localInterface),
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
          call.resolve(response.return);
          break;
      }
    } else {
      logger.error("Received invalid message: '%s'.", decoded.error);
    }
  }

  private localCall(call: RemoteCall): void {
    const performCall = async (method: string, argument: unknown): Promise<unknown> => {
      if (!(method in this.options.localInterface)) {
        logger.error("Remote called an unknown method: %s.", method);
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

  private send(message: RemoteCallMessage): Promise<void> {
    logger.trace({ type: message.type }, "Sending message.");
    return this.sendFn(message);
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
        logger.error("Call to remote process timed out.");
        call.reject("Call to remote process timed out.");
        this.emitter.emit("timeout");
      }, this.options.timeout),
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

    try {
      let result = await promise;

      if (method in this.options.responseDecoders) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        result = this.options.responseDecoders[method](result);
      }
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
