import { setImmediate } from "timers";

import { JsonDecoder } from "ts.data.json";

import {
  Decoder,
  RemotableInterface,
  ArgDecodersFor,
  ReturnDecodersFor,
  IntoPromises,
} from "./meta";
import { Channel } from "./rpc";

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
