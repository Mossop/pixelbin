type ResolverArg<T> = T | PromiseLike<T> | undefined;
export type Resolver<T, R = void> = (value?: ResolverArg<T>) => R;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rejecter<R = void> = (reason?: any) => R;

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: Resolver<T>;
  reject: Rejecter;
}

export function defer<T = void>(): Deferred<T> {
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

interface TrackedPromise<T> {
  promise: Promise<T>;
  id: string;
}

export class PromiseTracker<T> {
  private nextId: number;
  private promises: Record<number, Deferred<T>>;

  public constructor() {
    this.nextId = 0;
    this.promises = {};
  }

  public defer(): TrackedPromise<T> {
    let id = this.nextId++;

    let deferred = defer<T>();
    this.promises[id] = deferred;

    return {
      promise: deferred.promise,
      id: String(id),
    };
  }

  public resolve(id: string, value?: T): void {
    let deferred = this.promises[id];
    delete this.promises[id];
    deferred.resolve(value);
  }

  public reject(id: string, error?: unknown): void {
    let deferred = this.promises[id];
    delete this.promises[id];
    deferred.reject(error);
  }

  public rejectAll(error?: unknown): void {
    let keys = Object.keys(this.promises);
    for (let key of keys) {
      this.reject(key, error);
    }
  }
}