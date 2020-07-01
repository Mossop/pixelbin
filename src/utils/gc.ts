interface CachedItem<T> {
  item: T,
  expiryTimer: NodeJS.Timeout | null,
  refCounted: RefCounted<T> | null,
  released: boolean,
}

export class Cache<K, T> {
  private cache: Map<K, CachedItem<T>>;

  public constructor(private timeout: number = 10000) {
    this.cache = new Map();
  }

  public release(): void {
    for (let cached of this.cache.values()) {
      if (cached.expiryTimer) {
        clearTimeout(cached.expiryTimer);
        cached.expiryTimer = null;
      }
      cached.released = true;
    }

    this.cache.clear();
  }

  public take(key: K, item: T): RefCounted<T> {
    let cached: CachedItem<T> = {
      item,
      expiryTimer: null,
      released: false,
      refCounted: new RefCounted(item, (): void => {
        cached.refCounted = null;
        if (cached.released) {
          return;
        }

        cached.expiryTimer = setTimeout((): void => {
          if (this.cache.get(key) === cached) {
            this.cache.delete(key);
          }
        }, this.timeout);
      }),
    };

    this.cache.set(key, cached);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return cached.refCounted!;
  }

  public getOrCreate(key: K, creator: () => T): RefCounted<T> {
    let counted = this.get(key);
    if (counted) {
      return counted;
    }

    let item = creator();
    return this.take(key, item);
  }

  public get(key: K): RefCounted<T> | null {
    let cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    if (cached.refCounted) {
      return cached.refCounted.addRef();
    }

    if (cached.expiryTimer) {
      clearTimeout(cached.expiryTimer);
      cached.expiryTimer = null;
    }

    return this.take(key, cached.item);
  }
}

export abstract class RefCountedObject {
  private refCount: number;
  private destroyed: boolean;

  protected constructor() {
    this.refCount = 1;
    this.destroyed = false;
  }

  protected abstract destroy(): void;

  protected get isDestroyed(): boolean {
    return this.destroyed;
  }

  public addRef(): this {
    if (this.destroyed) {
      throw new Error("Attempt to addRef an already destroyed object.");
    }

    this.refCount++;
    return this;
  }

  public release(): void {
    if (this.destroyed) {
      throw new Error("Attempt to release an already destroyed object.");
    }

    this.refCount--;
    if (this.refCount == 0) {
      this.destroy();
      this.destroyed = true;
    }
  }
}

export class RefCounted<T> extends RefCountedObject {
  public constructor(private inner: T, private destroyer: (item: T) => void) {
    super();
  }

  protected destroy(): void {
    this.destroyer.call(null, this.inner);
  }

  public get(): T {
    if (this.isDestroyed) {
      throw new Error("Attempt to use an already destroyed object.");
    }

    return this.inner;
  }
}
