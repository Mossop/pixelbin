import { isReference } from "../api/highlevel";
import request from "../api/request";
import { ApiErrorCode, ApiMethod } from "../api/types";
import { ErrorCode, AppError } from "../utils/exception";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBeAppError(received: any, code: ErrorCode | ApiErrorCode): jest.CustomMatcherResult {
  if (received instanceof AppError) {
    if (received.code == code) {
      return {
        message: (): string => `Did not expect AppError code ${received.code}.`,
        pass: true,
      };
    } else {
      return {
        message: (): string => `Expected AppError code ${code} but got ${received.code}.`,
        pass: false,
      };
    }
  } else {
    return {
      message: (): string => `Expected an AppError but got ${received}.`,
      pass: false,
    };
  }
}

const matchers = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toBeRef(received: any, id: string): jest.CustomMatcherResult {
    if (isReference(received) && received.id == id) {
      return {
        message: (): string => `expected ${received} not to be a reference with id ${id}`,
        pass: true,
      };
    } else {
      return {
        message: (): string => `expected ${received} to be a reference with id ${id}`,
        pass: false,
      };
    }
  },

  toThrowAppError(received: () => void, code: ErrorCode | ApiErrorCode): jest.CustomMatcherResult {
    try {
      received();
      return {
        message: (): string => `expected ${received} to throw an exception.`,
        pass: false,
      };
    } catch (e) {
      return toBeAppError(e, code);
    }
  },

  toBeAppError,
};

expect.extend(matchers);

const jestExpect = expect as unknown as jest.ExtendedExpect<typeof matchers>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockedFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
  expect("mock" in fn).toBeTruthy();
  return fn as jest.MockedFunction<T>;
}

export function mockedClass<T extends jest.Constructable>(cls: T): jest.MockedClass<T> {
  expect("mock" in cls).toBeTruthy();
  return cls as jest.MockedClass<T>;
}

export const mapOf = <V>(obj: Record<string, V>): Map<string, V> => new Map(Object.entries(obj));

export function lastCallArgs<P extends unknown[]>(mock: jest.MockInstance<unknown, P>): P {
  expect(mock).toHaveBeenCalled();

  let count = mock.mock.calls.length;
  return mock.mock.calls[count - 1];
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
    mock.mockImplementationOnce((...args: unknown[]): unknown => {
      resolve(args);
      return result;
    });
  });
}

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

type ResolverArg<T> = T | PromiseLike<T> | undefined;
type Resolver<T, R = void> = (value?: ResolverArg<T>) => R;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rejecter<R = void> = (reason?: any) => R;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: Resolver<T>;
  reject: Rejecter;
}

function defer<T>(): Deferred<T> {
  let resolve: Resolver<T> | undefined = undefined;
  let reject: Rejecter | undefined = undefined;

  let promise = new Promise<T>((resolver: Resolver<T>, rejecter: Rejecter): void => {
    resolve = resolver;
    reject = rejecter;
  });

  return {
    promise,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    resolve: resolve!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    reject: reject!,
  };
}

type PromiseType<P> = P extends Promise<infer T> ? T : never;

interface DeferredCall<A, R> {
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

export function deferRequest<R = unknown, D = unknown>(): DeferredCall<[ApiMethod, D], R> {
  return deferCall(request as unknown as (method: ApiMethod, data: D) => Promise<R>);
}

export { jestExpect as expect };
export * from "./dom";
export * from "./store";
