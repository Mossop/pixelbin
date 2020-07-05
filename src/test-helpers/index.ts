import { expect as jestExpect } from "@jest/globals";
import diff from "jest-diff";
import moment, { Moment, isMoment } from "moment-timezone";

import { defer } from "../utils";

const matchers = {
  toEqualDate(
    this: jest.MatcherContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    received: any,
    expected: Moment | string,
  ): jest.CustomMatcherResult {
    const receivedMoment = isMoment(received) ? received : moment.tz(received, "UTC");
    const expectedMoment = isMoment(expected) ? expected : moment.tz(expected, "UTC");

    const receivedAsString = receivedMoment.format("L");
    const expectedAsString = expectedMoment.format("L");

    const pass = receivedMoment.isSame(expectedMoment);

    const message = pass ?
      (): string =>
        `${this.utils.matcherHint(".not.toBe")}\n\n` +
          "Expected date to not be same date as:\n" +
          `  ${this.utils.printExpected(expectedAsString)}\n` +
          "Received:\n" +
          `  ${this.utils.printReceived(receivedAsString)}` :
      (): string => {
        const diffString = diff(expectedAsString, receivedAsString, {
          expand: this.expand,
        });
        return `${this.utils.matcherHint(".toBe")}\n\n` +
            "Expected value to be (using ===):\n" +
            `  ${this.utils.printExpected(expectedAsString)}\n` +
            "Received:\n" +
            `  ${this.utils.printReceived(receivedAsString)}${diffString ?
              `\n\nDifference:\n\n${diffString}` :
              ""}`;
      };
    return { message, pass };
  },
};

jestExpect.extend(matchers);
export const expect = jestExpect as unknown as jest.ExtendedExpect<typeof matchers>;

export function after(promise: Promise<unknown>): Promise<void> {
  return promise.then(
    (): void => {
      return;
    },
    (): void => {
      return;
    },
  );
}

type PromiseType<P> = P extends Promise<infer T> ? T : never;
type ResolverArg<T> = T | PromiseLike<T> | undefined;
type Resolver<T, R = void> = (value?: ResolverArg<T>) => R;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rejecter<R = void> = (reason?: any) => R;

export interface DeferredCall<A, R> {
  promise: Promise<R>;
  resolve: Resolver<R, Promise<void>>;
  reject: Rejecter<Promise<void>>;
  call: Promise<A>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deferCall<F extends (...args: any[]) => any>(
  func: F | jest.MockedFunction<F>): DeferredCall<Parameters<F>, PromiseType<ReturnType<F>>> {
  expect("mock" in func).toBeTruthy();

  let mock = func as unknown as jest.MockInstance<
    Promise<PromiseType<ReturnType<F>>>,
    Parameters<F>
  >;

  let deferredCall = defer<Parameters<F>>();

  let deferredResult = defer<PromiseType<ReturnType<F>>>();
  mock.mockImplementationOnce((...args: Parameters<F>): Promise<PromiseType<ReturnType<F>>> => {
    deferredCall.resolve(args);
    return deferredResult.promise;
  });

  return {
    promise: deferredResult.promise,

    resolve: (value?: ResolverArg<PromiseType<ReturnType<F>>>): Promise<void> => {
      deferredResult.resolve(value);
      return after(deferredResult.promise);
    },

    reject: (reason?: unknown): Promise<void> => {
      deferredResult.reject(reason);
      return after(deferredResult.promise);
    },

    call: deferredCall.promise,
  };
}

export function awaitCall<A extends unknown[]>(
  mock: jest.MockInstance<void, A>,
): Promise<A>;
export function awaitCall<A extends unknown[], R>(
  mock: jest.MockInstance<R, A>,
  result: R,
): Promise<A>;

export function awaitCall(
  mock: jest.MockInstance<unknown, unknown[]>,
  result?: unknown,
): Promise<unknown> {
  return new Promise((resolve: (params: unknown) => void): void => {
    let previous = mock.getMockImplementation();
    mock.mockImplementationOnce((...args: unknown[]): unknown => {
      resolve(args);

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (result !== undefined && previous !== undefined) {
        return previous(...args);
      }
      return result;
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockedFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
  expect("mock" in fn).toBeTruthy();
  return fn as jest.MockedFunction<T>;
}

export function mockedClass<T extends jest.Constructable>(cls: T): jest.MockedClass<T> {
  expect("mock" in cls).toBeTruthy();
  return cls as jest.MockedClass<T>;
}

export function lastCallArgs<P extends unknown[]>(mock: jest.MockInstance<unknown, P>): P {
  expect(mock).toHaveBeenCalled();

  let count = mock.mock.calls.length;
  return mock.mock.calls[count - 1];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Mocked<Fn extends (...args: any[]) => any> = jest.Mock<ReturnType<Fn>, Parameters<Fn>>;
export function mock<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Fn extends (...args: any[]) => any
>(implementation?: Fn): Mocked<Fn> {
  return jest.fn<ReturnType<Fn>, Parameters<Fn>>(implementation);
}
