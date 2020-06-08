import { JsonDecoder } from "ts.data.json";

import { Decoder, RemotableInterface, ArgDecodersFor, ReturnDecodersFor } from "./meta";
import { Channel } from "./rpc";

function decoderFrom<T>(js: JsonDecoder.Decoder<T>): Decoder<T> {
  return (val: unknown): Promise<T> => js.decodePromise(val);
}

interface JoinedChannels<L extends RemotableInterface, R extends RemotableInterface> {
  left: Channel<R, L>;
  right: Channel<L, R>;
}

function joinedChannels<L extends RemotableInterface, R extends RemotableInterface>(
  leftInterface: L,
  leftArgDecoders: ArgDecodersFor<L>,
  leftResultDecoders: ReturnDecodersFor<L>,
  rightInterface: R,
  rightArgDecoders: ArgDecodersFor<R>,
  rightResultDecoders: ReturnDecodersFor<R>,
): JoinedChannels<L, R> {
  let left = new Channel<R, L>((message: unknown): Promise<void> => {
    right.onMessage(message);
    return Promise.resolve();
  }, {
    timeout: 500000,
    localInterface: leftInterface,
    requestDecoders: leftArgDecoders,
    responseDecoders: rightResultDecoders,
  });

  let right = new Channel<L, R>((message: unknown): Promise<void> => {
    left.onMessage(message);
    return Promise.resolve();
  }, {
    timeout: 500000,
    localInterface: rightInterface,
    requestDecoders: rightArgDecoders,
    responseDecoders: leftResultDecoders,
  });

  return {
    left,
    right,
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

  let { left, right } = joinedChannels(
    leftInterface,
    leftArgDecoders,
    leftResultDecoders,
    rightInterface,
    rightArgDecoders,
    rightResultDecoders,
  );

  expect(rightInterface.decrement).not.toHaveBeenCalled();
  let result = await left.remote.decrement(5);
  expect(result).toBe(4);
  expect(rightInterface.decrement).toHaveBeenCalledTimes(1);

  expect(leftInterface.increment).not.toHaveBeenCalled();
  result = await right.remote.increment(5);
  expect(result).toBe(6);
  expect(leftInterface.increment).toHaveBeenCalledTimes(1);

  expect(leftInterface.noop).not.toHaveBeenCalled();
  // @ts-ignore: Want to verify exactly what is returned here.
  result = await right.remote.noop();
  expect(result).toBeUndefined();
  expect(leftInterface.noop).toHaveBeenCalledTimes(1);
});
