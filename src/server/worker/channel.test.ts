import type { SendHandle } from "child_process";
import { setImmediate } from "timers";

import { lastCallArgs, mockEvent } from "../../test-helpers";
import type { RemoteInterface } from "./channel";
import Channel from "./channel";

jest.useFakeTimers();

interface JoinedChannels<L, R> {
  leftChannel: Channel<R, L>;
  rightChannel: Channel<L, R>;

  left: RemoteInterface<L>;
  right: RemoteInterface<R>;
}

async function joinedChannels<L, R>(
  leftInterface: L,
  rightInterface: R,
): Promise<JoinedChannels<L, R>> {
  let left = Channel.create<
    R,
    L
  >((message: unknown, handle: undefined | SendHandle): Promise<void> => {
    setImmediate((): void => {
      right.onMessage(message, handle);
    });
    return Promise.resolve();
  }, {
    timeout: 500000,
    localInterface: leftInterface,
  });

  let right = Channel.connect<
    L,
    R
  >((message: unknown, handle: undefined | SendHandle): Promise<void> => {
    setImmediate((): void => {
      left.onMessage(message, handle);
    });
    return Promise.resolve();
  }, {
    timeout: 500000,
    localInterface: rightInterface,
  });

  return {
    leftChannel: left,
    rightChannel: right,

    left: await right.remote,
    right: await left.remote,
  };
}

test("remote calls", async (): Promise<void> => {
  let leftInterface = {
    increment: jest.fn((val: number): number => val + 1),
    noop: jest.fn((): void => {
      // Do nothing
    }),
  };

  let rightInterface = {
    decrement: jest.fn((val: number): number => val - 1),
  };

  let { left, right, leftChannel } = await joinedChannels(
    leftInterface,
    rightInterface,
  );

  expect(rightInterface.decrement).not.toHaveBeenCalled();
  let result = await right.decrement(5);
  expect(result).toBe(4);
  expect(rightInterface.decrement).toHaveBeenCalledTimes(1);

  expect(leftInterface.increment).not.toHaveBeenCalled();
  result = await left.increment(5);
  expect(result).toBe(6);
  expect(leftInterface.increment).toHaveBeenCalledTimes(1);

  expect(leftInterface.noop).not.toHaveBeenCalled();
  // @ts-ignore
  result = await left.noop();
  expect(result).toBeUndefined();
  expect(leftInterface.noop).toHaveBeenCalledTimes(1);

  leftInterface.increment.mockImplementationOnce((val: number): number => {
    throw new Error(`Bad call ${val}.`);
  });

  await expect(left.increment(5)).rejects.toThrow("Bad call 5.");

  leftChannel.close();
  await expect(right.decrement(6)).rejects.toThrowError(
    "Channel to remote process is closed.",
  );

  await expect(left.increment(6)).rejects.toThrowError(
    "Channel to remote process closed before call returned.",
  );

  await expect(left.increment(6)).rejects.toThrowError(
    "Channel to remote process is closed.",
  );
});

test("connect timeout", async (): Promise<void> => {
  let local = {
    increment: jest.fn((val: number): number => val + 1),
    noop: jest.fn((): void => {
      // Do nothing
    }),
  };

  let send = jest.fn((_message: unknown): Promise<void> => Promise.resolve());
  let channel = Channel.connect(send, {
    localInterface: local,
  });

  let timeoutCallback = mockEvent(channel, "connection-timeout");
  let closeCallback = mockEvent(channel, "close");

  expect(send).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(send)).toEqual([{
    type: "connect",
    methods: ["increment", "noop"],
  }, undefined]);

  jest.runAllTimers();

  await expect(channel.remote).rejects.toThrow("Channel connection timed out.");
  expect(closeCallback).toHaveBeenCalledTimes(1);
  expect(timeoutCallback).toHaveBeenCalledTimes(1);
});

test("create timeout", async (): Promise<void> => {
  let send = jest.fn((_message: unknown): Promise<void> => Promise.resolve());
  let channel = Channel.create(send);

  let timeoutCallback = mockEvent(channel, "connection-timeout");
  let closeCallback = mockEvent(channel, "close");

  jest.runAllTimers();

  await expect(channel.remote).rejects.toThrow("Channel connection timed out.");
  expect(closeCallback).toHaveBeenCalledTimes(1);
  expect(timeoutCallback).toHaveBeenCalledTimes(1);
});

test("remote calling", async (): Promise<void> => {
  let local = {
    increment: jest.fn((val: number): number => val + 1),
    noop: jest.fn((): void => {
      // Do nothing
    }),
  };

  interface RemoteInterface {
    decrement: (val: number) => number;
  }

  let send = jest.fn((_message: unknown): Promise<void> => Promise.resolve());
  let channel = Channel.connect<RemoteInterface, typeof local>(send, {
    localInterface: local,
  });

  let callbacks: Record<string, jest.Mock<void, [string]>> = {};
  for (let event of [
    "close",
    "message-call",
    "message-fail",
    "message-result",
    "message-timeout",
  ]) {
    callbacks[event] = jest.fn();
    // @ts-ignore
    channel.on(event, (): void => callbacks[event](event));
  }

  expect(send).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(send)).toEqual([{
    type: "connect",
    methods: ["increment", "noop"],
  }, undefined]);
  send.mockClear();

  channel.onMessage({
    type: "connected",
    methods: ["decrement"],
  }, undefined);

  jest.runAllTimers();

  let remote = await channel.remote;
  expect(Object.keys(remote)).toEqual(["decrement"]);

  expect(callbacks.close).not.toHaveBeenCalled();
  expect(callbacks["message-call"]).not.toHaveBeenCalled();
  expect(callbacks["message-fail"]).not.toHaveBeenCalled();
  expect(callbacks["message-result"]).not.toHaveBeenCalled();
  expect(callbacks["message-timeout"]).not.toHaveBeenCalled();

  // -------------------------------------

  let result = remote.decrement(5);

  expect(callbacks.close).not.toHaveBeenCalled();
  expect(callbacks["message-call"]).toHaveBeenCalledTimes(1);
  callbacks["message-call"].mockClear();
  expect(callbacks["message-fail"]).not.toHaveBeenCalled();
  expect(callbacks["message-result"]).not.toHaveBeenCalled();
  expect(callbacks["message-timeout"]).not.toHaveBeenCalled();

  expect(send).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(send)).toEqual([{
    type: "call",
    id: "0",
    method: "decrement",
    arguments: [5],
    handleArgument: null,
  }, undefined]);
  send.mockClear();

  channel.onMessage({
    type: "ack",
    id: "0",
  }, undefined);

  jest.runAllTimers();

  channel.onMessage({
    type: "exception",
    id: "0",
    error: new Error("Test call failure"),
  }, undefined);

  await expect(result).rejects.toThrow("Test call failure");

  expect(callbacks.close).not.toHaveBeenCalled();
  expect(callbacks["message-call"]).not.toHaveBeenCalled();
  expect(callbacks["message-fail"]).toHaveBeenCalledTimes(1);
  callbacks["message-fail"].mockClear();
  expect(callbacks["message-result"]).not.toHaveBeenCalled();
  expect(callbacks["message-timeout"]).not.toHaveBeenCalled();

  // -------------------------------------

  result = remote.decrement(7);

  expect(callbacks.close).not.toHaveBeenCalled();
  expect(callbacks["message-call"]).toHaveBeenCalledTimes(1);
  callbacks["message-call"].mockClear();
  expect(callbacks["message-fail"]).not.toHaveBeenCalled();
  expect(callbacks["message-result"]).not.toHaveBeenCalled();
  expect(callbacks["message-timeout"]).not.toHaveBeenCalled();

  expect(send).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(send)).toEqual([{
    type: "call",
    id: "1",
    method: "decrement",
    arguments: [7],
    handleArgument: null,
  }, undefined]);
  send.mockClear();

  channel.onMessage({
    type: "ack",
    id: "1",
  }, undefined);

  jest.runAllTimers();

  channel.onMessage({
    type: "return",
    id: "1",
    return: 8,
  }, undefined);

  await expect(result).resolves.toBe(8);

  expect(callbacks.close).not.toHaveBeenCalled();
  expect(callbacks["message-call"]).not.toHaveBeenCalled();
  expect(callbacks["message-fail"]).not.toHaveBeenCalled();
  expect(callbacks["message-result"]).toHaveBeenCalledTimes(1);
  callbacks["message-result"].mockClear();
  expect(callbacks["message-timeout"]).not.toHaveBeenCalled();

  // -------------------------------------

  result = remote.decrement(58);

  expect(callbacks.close).not.toHaveBeenCalled();
  expect(callbacks["message-call"]).toHaveBeenCalledTimes(1);
  callbacks["message-call"].mockClear();
  expect(callbacks["message-fail"]).not.toHaveBeenCalled();
  expect(callbacks["message-result"]).not.toHaveBeenCalled();
  expect(callbacks["message-timeout"]).not.toHaveBeenCalled();

  expect(send).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(send)).toEqual([{
    type: "call",
    id: "2",
    method: "decrement",
    arguments: [58],
    handleArgument: null,
  }, undefined]);
  send.mockClear();

  jest.runAllTimers();

  await expect(result).rejects.toThrow("Call to remote process timed out.");

  expect(callbacks.close).not.toHaveBeenCalled();
  expect(callbacks["message-call"]).not.toHaveBeenCalled();
  expect(callbacks["message-fail"]).toHaveBeenCalledTimes(1);
  callbacks["message-fail"].mockClear();
  expect(callbacks["message-result"]).not.toHaveBeenCalled();
  expect(callbacks["message-timeout"]).toHaveBeenCalledTimes(1);
  callbacks["message-timeout"].mockClear();

  // -------------------------------------

  result = remote.decrement(22);

  expect(callbacks.close).not.toHaveBeenCalled();
  expect(callbacks["message-call"]).toHaveBeenCalledTimes(1);
  callbacks["message-call"].mockClear();
  expect(callbacks["message-fail"]).not.toHaveBeenCalled();
  expect(callbacks["message-result"]).not.toHaveBeenCalled();
  expect(callbacks["message-timeout"]).not.toHaveBeenCalled();

  expect(send).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(send)).toEqual([{
    type: "call",
    id: "3",
    method: "decrement",
    arguments: [22],
    handleArgument: null,
  }, undefined]);
  send.mockClear();

  channel.close();

  await expect(result).rejects.toThrow("Channel to remote process closed before call returned.");

  expect(callbacks.close).toHaveBeenCalledTimes(1);
  callbacks.close.mockClear();
  expect(callbacks["message-call"]).not.toHaveBeenCalled();
  expect(callbacks["message-fail"]).toHaveBeenCalledTimes(1);
  callbacks["message-fail"].mockClear();
  expect(callbacks["message-result"]).not.toHaveBeenCalled();
  expect(callbacks["message-timeout"]).not.toHaveBeenCalled();
});

test("undefined interface", async (): Promise<void> => {
  let { leftChannel, rightChannel } = await joinedChannels(undefined, undefined);

  expect(await leftChannel.remote).toBeUndefined();
  expect(await rightChannel.remote).toBeUndefined();
});

