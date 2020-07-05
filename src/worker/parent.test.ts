import { Serializable, SendHandle } from "child_process";
import { EventEmitter } from "events";
import { Socket, Server } from "net";
import { setImmediate } from "timers";

import { mock, Mocked, awaitCall, deferCall } from "../test-helpers";
import Channel from "./channel";
import { RPC } from "./ipc";
import { AbstractProcess, ParentProcess } from "./parent";

jest.useFakeTimers();

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

  let parent = new ParentProcess<R>({
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

  let remote = await parent.remote;
  expect("foo" in remote).toBeTruthy();
  expect("bar" in remote).toBeTruthy();
  expect("baz" in remote).toBeFalsy();

  let deferred = deferCall(remoteInterface.foo);
  let result = remote.foo(5);

  await expect(deferred.call).resolves.toEqual([5]);
  deferred.resolve("bizzy");

  await expect(result).resolves.toBe("bizzy");

  let closed = jest.fn();
  channel.on("close", closed);
  let called = awaitCall(closed);

  parent.shutdown();

  await called;

  expect(process.disconnect).toHaveBeenCalledTimes(1);

  parent.shutdown();

  expect(process.disconnect).toHaveBeenCalledTimes(1);
});
