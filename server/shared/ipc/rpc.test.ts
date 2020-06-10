import { setImmediate } from "timers";

import { JsonDecoder } from "ts.data.json";

import { lastCallArgs } from "../../test-helpers";
import {
  Decoder,
  RemotableInterface,
  ArgDecodersFor,
  ReturnDecodersFor,
  IntoPromises,
} from "./meta";
import { Channel } from "./rpc";

jest.useFakeTimers();

function decoderFrom<T>(js: JsonDecoder.Decoder<T>): Decoder<T> {
  return async (val: unknown): Promise<T> => {
    try {
      return await js.decodePromise(val);
    } catch (e) {
      // JsonDecoder "throws" as plain string.
      throw new Error(e);
    }
  };
}

interface JoinedChannels<L extends RemotableInterface, R extends RemotableInterface> {
  leftChannel: Channel<R, L>;
  rightChannel: Channel<L, R>;

  left: IntoPromises<L>;
  right: IntoPromises<R>;
}

async function joinedChannels<L extends RemotableInterface, R extends RemotableInterface>(
  leftInterface: L,
  leftArgDecoders: ArgDecodersFor<L>,
  leftResultDecoders: ReturnDecodersFor<L>,
  rightInterface: R,
  rightArgDecoders: ArgDecodersFor<R>,
  rightResultDecoders: ReturnDecodersFor<R>,
): Promise<JoinedChannels<L, R>> {
  let left = Channel.create<R, L>((message: unknown): Promise<void> => {
    setImmediate((): void => {
      right.onMessage(message);
    });
    return Promise.resolve();
  }, {
    timeout: 500000,
    localInterface: leftInterface,
    requestDecoders: leftArgDecoders,
    responseDecoders: rightResultDecoders,
  });

  let right = Channel.connect<L, R>((message: unknown): Promise<void> => {
    setImmediate((): void => {
      left.onMessage(message);
    });
    return Promise.resolve();
  }, {
    timeout: 500000,
    localInterface: rightInterface,
    requestDecoders: rightArgDecoders,
    responseDecoders: leftResultDecoders,
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

  let leftArgDecoders = {
    increment: decoderFrom(JsonDecoder.number),
  };

  let leftResultDecoders = {
    increment: decoderFrom(JsonDecoder.number),
  };

  let rightInterface = {
    decrement: jest.fn((val: number): number => val - 1),
  };

  let rightArgDecoders = {
    decrement: decoderFrom(JsonDecoder.number),
  };

  let rightResultDecoders = {
    decrement: decoderFrom(JsonDecoder.number),
  };

  let { left, right, leftChannel } = await joinedChannels(
    leftInterface,
    leftArgDecoders,
    leftResultDecoders,
    rightInterface,
    rightArgDecoders,
    rightResultDecoders,
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
  // @ts-ignore: Want to verify exactly what is returned here.
  result = await left.noop();
  expect(result).toBeUndefined();
  expect(leftInterface.noop).toHaveBeenCalledTimes(1);

  leftInterface.increment.mockImplementationOnce((val: number): number => {
    throw new Error(`Bad call ${val}.`);
  });

  await expect(left.increment(5)).rejects.toThrow("Bad call 5.");

  // @ts-ignore: Testing what happens for invalid arguments.
  await expect(left.increment("test")).rejects.toThrow("\"test\" is not a valid number");

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

  let argDecoders = {
    increment: decoderFrom(JsonDecoder.number),
  };

  let responseDecoders = {
    decrement: decoderFrom(JsonDecoder.number),
  };

  interface RemoteInterface extends RemotableInterface {
    decrement: (val: number) => number;
  }

  let send = jest.fn((_message: unknown): Promise<void> => Promise.resolve());
  let channel = Channel.connect<RemoteInterface, typeof local>(send, {
    localInterface: local,
    requestDecoders: argDecoders,
    responseDecoders: responseDecoders,
  });

  let timeoutCallback = jest.fn();
  channel.on("connection-timeout", timeoutCallback);
  let closeCallback = jest.fn();
  channel.on("close", closeCallback);

  expect(send).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(send)).toEqual([{
    type: "connect",
    methods: ["increment", "noop"],
  }]);

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

  let argDecoders = {
    increment: decoderFrom(JsonDecoder.number),
  };

  let responseDecoders = {
    decrement: decoderFrom(JsonDecoder.number),
  };

  interface RemoteInterface extends RemotableInterface {
    decrement: (val: number) => number;
  }

  let send = jest.fn((_message: unknown): Promise<void> => Promise.resolve());
  let channel = Channel.connect<RemoteInterface, typeof local>(send, {
    localInterface: local,
    requestDecoders: argDecoders,
    responseDecoders: responseDecoders,
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
    // @ts-ignore: Trust me, this is fine.
    channel.on(event, (): void => callbacks[event](event));
  }

  expect(send).toHaveBeenCalledTimes(1);
  expect(lastCallArgs(send)).toEqual([{
    type: "connect",
    methods: ["increment", "noop"],
  }]);
  send.mockClear();

  channel.onMessage({
    type: "connected",
    methods: ["decrement"],
  });

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
    argument: 5,
  }]);
  send.mockClear();

  channel.onMessage({
    type: "ack",
    id: "0",
  });

  jest.runAllTimers();

  channel.onMessage({
    type: "exception",
    id: "0",
    error: new Error("Test call failure"),
  });

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
    argument: 7,
  }]);
  send.mockClear();

  channel.onMessage({
    type: "ack",
    id: "1",
  });

  jest.runAllTimers();

  channel.onMessage({
    type: "return",
    id: "1",
    return: 8,
  });

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
    argument: 58,
  }]);
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
});
