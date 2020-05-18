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
