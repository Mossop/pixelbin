import { Serializable, SendHandle } from "child_process";
import { EventEmitter } from "events";
import { Socket, Server } from "net";
import { setImmediate } from "timers";

import { mock, Mocked, awaitCall, deferCall, awaitEvent } from "../../test-helpers";
import { defer, Deferred } from "../../utils";
import Channel from "./channel";
import { RPC } from "./ipc";
import { AbstractProcess, ParentProcess } from "./parent";

/* eslint-disable */
jest.mock("./channel", () => {
  let realChannel = jest.requireActual("./channel").default;
  return {
    __esModule: true,
    default: {
      create: jest.fn((...args) => realChannel.create(...args)),
      connect: jest.fn((...args) => realChannel.connect(...args)),
    },
  };
});
/* eslint-enable */

jest.useFakeTimers();

class MockChannel<R = unknown> extends EventEmitter {
  public close: Mocked<() => void>;
  public onMessage: Mocked<(message: unknown, handle: unknown) => void>;
  public readonly deferredRemote: Deferred<R>;

  public constructor() {
    super();
    this.close = jest.fn();
    this.onMessage = jest.fn();
    this.deferredRemote = defer<R>();
  }

  public get remote(): Promise<R> {
    return this.deferredRemote.promise;
  }
}

function mockCreate<R = unknown>(): MockChannel<R> {
  let channel = new MockChannel<R>();
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let create = Channel.create;
  if (jest.isMockFunction(create)) {
    create.mockReturnValueOnce(channel);
  }
  return channel;
}

class MockParentProcess extends EventEmitter {
  public send: Mocked<AbstractProcess["send"]>;
  public disconnect: Mocked<AbstractProcess["disconnect"]>;

  public constructor() {
    super();
    this.send = mock<AbstractProcess["send"]>((
      message: Serializable,
      sendHandle: SendHandle | undefined,
      options: undefined,
      callback: (error: Error | null) => void,
    ): void => {
      callback(null);
    });
    this.disconnect = mock<AbstractProcess["disconnect"]>();
  }
}

interface Connected<R> {
  process: MockParentProcess;
  parent: ParentProcess<R>;
  channel: Channel<undefined, R>;
}

function isRPCMessage(message: Serializable): message is RPC {
  return typeof message == "object" && message["type"] == "rpc";
}

async function connect<R>(remoteInterface: R): Promise<Connected<R>> {
  let process = new MockParentProcess();

  let channel: Channel<undefined, R> | null = null;

  process.send.mockImplementation((
    message: Serializable,
    sendHandle: SendHandle | undefined,
    options: undefined,
    callback: (error: Error | null) => void,
  ): void => {
    if (isRPCMessage(message)) {
      setImmediate((): void => {
        if (channel) {
          channel.onMessage(message.message, sendHandle);
        }
      });
    }

    callback(null);
  });

  let readyMsg = awaitCall(process.send);

  let parentPromise = ParentProcess.connect<R>({
    process,
  });

  let readyArgs = await readyMsg;
  expect(readyArgs[0]).toEqual({
    type: "ready",
  });

  channel = Channel.connect(
    (message: unknown, handle?: Socket | Server | undefined): Promise<void> => {
      process.emit("message", {
        type: "rpc",
        message,
      }, handle);

      return Promise.resolve();
    },
    {
      localInterface: remoteInterface,
    },
  );

  let parent = await parentPromise;

  return {
    process,
    parent,
    channel,
  };
}

test("parent", async (): Promise<void> => {
  let remoteInterface = {
    foo: jest.fn<Promise<string>, [number]>(),
    bar: jest.fn<Promise<number>, [string]>(),
  };

  let {
    parent,
    process,
    channel,
  } = await connect(remoteInterface);

  expect("foo" in parent.remote).toBeTruthy();
  expect("bar" in parent.remote).toBeTruthy();
  expect("baz" in parent.remote).toBeFalsy();

  let deferred = deferCall(remoteInterface.foo);
  let result = parent.remote.foo(5);

  await expect(deferred.call).resolves.toEqual([5]);
  await deferred.resolve("bizzy");

  await expect(result).resolves.toBe("bizzy");

  let closed = awaitEvent(channel, "close");
  let disconnected = awaitEvent(parent, "disconnect");

  parent.shutdown();

  await closed;
  await disconnected;

  expect(process.disconnect).toHaveBeenCalledTimes(1);

  parent.shutdown();

  expect(process.disconnect).toHaveBeenCalledTimes(1);
});

test("channel connect timeout", async (): Promise<void> => {
  let mockProcess = new MockParentProcess();

  let mockChannel = mockCreate();

  let parentPromise = ParentProcess.connect({
    process: mockProcess,
  });

  mockChannel.deferredRemote.reject(new Error("Connection timed out"));

  await expect(parentPromise).rejects.toThrow("Connection timed out");
});

test("channel message timeout", async (): Promise<void> => {
  let mockProcess = new MockParentProcess();

  let mockChannel = mockCreate();

  let parentPromise = ParentProcess.connect({
    process: mockProcess,
  });

  mockChannel.deferredRemote.resolve({});

  let parent = await parentPromise;
  let disconnect = awaitEvent(parent, "disconnect");

  mockChannel.emit("message-timeout");

  await disconnect;
});

test("process disconnect", async (): Promise<void> => {
  let mockProcess = new MockParentProcess();

  let mockChannel = mockCreate();

  let parentPromise = ParentProcess.connect({
    process: mockProcess,
  });

  mockChannel.deferredRemote.resolve({});

  let parent = await parentPromise;

  let disconnect = awaitEvent(parent, "disconnect");

  mockProcess.emit("disconnect");

  await disconnect;
});

test("process error", async (): Promise<void> => {
  let mockProcess = new MockParentProcess();

  let mockChannel = mockCreate();

  let parentPromise = ParentProcess.connect({
    process: mockProcess,
  });

  mockChannel.deferredRemote.resolve({});

  let parent = await parentPromise;

  let disconnect = awaitEvent(parent, "disconnect");

  mockProcess.emit("error");

  await disconnect;
});
