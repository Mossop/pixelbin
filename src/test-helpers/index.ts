import assert from "assert";
import { promises as fs } from "fs";
import path from "path";

import { expect as jestExpect } from "@jest/globals";
import { toMatchImageSnapshot } from "jest-image-snapshot";
import { DateTime as Luxon } from "luxon";

import { ObjectModel } from "../model";
import { DateTime, defer, now } from "../utils";

export function waitFor(
  cb: () => boolean,
  timeout: number = 1000,
  interval: number = 100,
): Promise<boolean> {
  let now = Date.now();

  return new Promise((resolve: (val: boolean) => void, reject: (err: Error) => void) => {
    let ival = setInterval(() => {
      if (cb()) {
        clearInterval(ival);
        resolve(true);
      } else if (Date.now() - now > timeout) {
        clearInterval(ival);
        reject(new Error(`Condition failed to return true in the alloted time (${timeout}ms).`));
      }
    }, interval);
  });
}

function expectMessage(
  context: jest.MatcherContext,
  term: string,
  expected: unknown,
  received: unknown,
): () => string {
  return (): string => {
    return [
      context.utils.matcherHint(term, undefined, undefined, {
        isNot: context.isNot,
        promise: context.promise,
      }),
      "",
      `Expected: ${context.utils.printExpected(expected)}\n`,
      `Received: ${context.utils.printReceived(received)}\n`,
    ].join("\n");
  };
}

const matchers = {
  toMatchImageSnapshot,

  toBeBetween(
    this: jest.MatcherContext,
    received: number,
    floor: number,
    ceiling: number,
  ): jest.CustomMatcherResult {
    const pass = received >= floor && received <= ceiling;

    return {
      pass,
      message: expectMessage(this, "toBeBetween", `${floor} - ${ceiling}`, received.toString()),
    };
  },

  toEqualDate(
    this: jest.MatcherContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    received: any,
    expected: DateTime | string,
  ): jest.CustomMatcherResult {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asStr = (val: any): string => {
      if (Luxon.isDateTime(val)) {
        return val.toUTC().toISO();
      }

      return Luxon.fromISO(val, {
        zone: "UTC",
      }).toUTC().toISO();
    };

    const receivedAsString = asStr(received);
    const expectedAsString = asStr(expected);

    return {
      pass: receivedAsString == expectedAsString,
      message: expectMessage(this, "toEqualDate", expectedAsString, receivedAsString),
    };
  },

  toInclude(
    this: jest.MatcherContext,
    received: unknown[],
    expected: unknown[],
  ): jest.CustomMatcherResult {
    let pass = Array.isArray(received) && Array.isArray(expected) &&
      received.length == expected.length;

    let remaining = [...expected];

    let rPos = 0;
    while (pass && rPos < received.length) {
      pass = false;
      let ePos = 0;
      while (!pass && ePos < remaining.length) {
        if (this.equals(received[rPos], remaining[ePos])) {
          remaining.splice(ePos, 1);
          pass = true;
        }
        ePos++;
      }
      rPos++;
    }

    return {
      pass,
      message: expectMessage(this, "toInclude", expected, received),
    };
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
type ResolverArg<T> = T | PromiseLike<T>;
type Resolver<T, R = void> = (value: ResolverArg<T>) => R;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rejecter<R = void> = (reason?: any) => R;

export interface DeferredCall<A, R> {
  promise: Promise<R>;
  resolve: Resolver<R, Promise<void>>;
  reject: Rejecter<Promise<void>>;
  call: Promise<A>;
}

export function deferCall<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  F extends (...args: any[]) => any
>(func: F | jest.MockedFunction<F>): DeferredCall<Parameters<F>, PromiseType<ReturnType<F>>> {
  assert(jest.isMockFunction(func));

  let deferredCall = defer<Parameters<F>>();

  let deferredResult = defer<PromiseType<ReturnType<F>>>();
  func.mockImplementationOnce((...args: Parameters<F>): Promise<PromiseType<ReturnType<F>>> => {
    deferredCall.resolve(args);
    return deferredResult.promise;
  });

  return {
    promise: deferredResult.promise,

    resolve: (value: ResolverArg<PromiseType<ReturnType<F>>>): Promise<void> => {
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
  result?: R,
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
      if (result === undefined && previous !== undefined) {
        return previous(...args);
      }
      return result;
    });
  });
}

interface BaseEmitterOnce<S, P extends unknown[]> {
  once: (event: S, cb: (...args: P) => void) => void;
}

interface BaseEmitter<S, P extends unknown[]> {
  on: (event: S, cb: (...args: P) => void) => void;
}

export function awaitEvent<
  S,
  P extends unknown[]
>(emitter: BaseEmitterOnce<S, P>, event: S): Promise<P> {
  let deferred = defer<P>();

  emitter.once(event, (...args: P): void => {
    deferred.resolve(args);
  });

  return deferred.promise;
}

export function mockEvent<
  S,
  P extends unknown[]
>(emitter: BaseEmitter<S, P>, event: S): jest.Mock<void, P> {
  let mock = jest.fn<void, P>();
  emitter.on(event, mock);
  return mock;
}

export function mockEventOnce<
  S,
  P extends unknown[]
>(emitter: BaseEmitterOnce<S, P>, event: S): jest.Mock<void, P> {
  let mock = jest.fn<void, P>();
  emitter.once(event, mock);
  return mock;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockedFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
  assert(jest.isMockFunction(fn));
  return fn;
}

export function mockedClass<T extends jest.Constructable>(cls: T): jest.MockedClass<T> {
  assert(jest.isMockFunction(cls));
  return cls;
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

export function mockDateTime(result: DateTime | string): DateTime {
  let dt = result instanceof Luxon
    ? result
    : Luxon.fromISO(result, {
      zone: "UTC",
      setZone: true,
    });

  let mockedNow = mockedFunction(now);

  mockedNow.mockImplementationOnce((): DateTime => {
    return dt;
  });

  return dt;
}

export async function getStorageConfig(
  id: string,
): Promise<Omit<ObjectModel.Storage, "id" | "owner"> | null> {
  let storeFile = path.join(__dirname, "..", "..", "testdata", "aws.json");
  let stores = JSON.parse(await fs.readFile(storeFile, { encoding: "utf8" }));

  let secretsFile = path.join(__dirname, "..", "..", "secrets.json");
  try {
    await fs.stat(secretsFile);

    let secrets = JSON.parse(await fs.readFile(secretsFile, { encoding: "utf8" }));
    if (id in secrets) {
      // @ts-ignore: This is correct.
      for (let [key, value] of Object.entries(secrets[id])) {
        // @ts-ignore: This is correct.
        stores[id][key] = value;
      }
    }
  } catch (e) {
    if (`STORAGE_${id.toUpperCase()}_ACCESS_KEY_ID` in process.env) {
      stores[id].accessKeyId = process.env[`STORAGE_${id.toUpperCase()}_ACCESS_KEY_ID`];
      stores[id].secretAccessKey = process.env[`STORAGE_${id.toUpperCase()}_SECRET_ACCESS_KEY`];
    }
  }

  if (!("accessKeyId" in stores[id])) {
    return null;
  }

  return {
    path: null,
    ...stores[id],
  } as Omit<ObjectModel.Storage, "id" | "owner">;
}

