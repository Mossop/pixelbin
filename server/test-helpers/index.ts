import defer from "../shared/defer";

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

export function lastCallArgs<P extends unknown[]>(mock: jest.MockInstance<unknown, P>): P {
  expect(mock).toHaveBeenCalled();

  let count = mock.mock.calls.length;
  return mock.mock.calls[count - 1];
}
