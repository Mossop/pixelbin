import { RefCountedObject, RefCounted, Cache } from "./gc";

jest.useFakeTimers();

interface RefCountedInternals {
  destroyed: boolean;
  refCount: number;
}

function internals(object: RefCountedObject): RefCountedInternals {
  return object as unknown as RefCountedInternals;
}

test("refcounted object", (): void => {
  class Foo extends RefCountedObject {
    public constructor(private callback: () => void) {
      super();
    }

    protected destroy(): void {
      this.callback();
    }
  }

  let destroy = jest.fn();
  let foo = new Foo(destroy);

  expect(destroy).not.toHaveBeenCalled();
  expect(internals(foo).destroyed).toBeFalsy();
  expect(internals(foo).refCount).toBe(1);

  expect(foo.addRef()).toBe(foo);
  expect(destroy).not.toHaveBeenCalled();
  expect(internals(foo).destroyed).toBeFalsy();
  expect(internals(foo).refCount).toBe(2);

  foo.addRef();
  expect(destroy).not.toHaveBeenCalled();
  expect(internals(foo).destroyed).toBeFalsy();
  expect(internals(foo).refCount).toBe(3);

  foo.release();
  expect(destroy).not.toHaveBeenCalled();
  expect(internals(foo).destroyed).toBeFalsy();
  expect(internals(foo).refCount).toBe(2);

  foo.release();
  expect(destroy).not.toHaveBeenCalled();
  expect(internals(foo).destroyed).toBeFalsy();
  expect(internals(foo).refCount).toBe(1);

  foo.addRef();
  expect(destroy).not.toHaveBeenCalled();
  expect(internals(foo).destroyed).toBeFalsy();
  expect(internals(foo).refCount).toBe(2);

  foo.release();
  expect(destroy).not.toHaveBeenCalled();
  expect(internals(foo).destroyed).toBeFalsy();
  expect(internals(foo).refCount).toBe(1);

  foo.release();
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(internals(foo).destroyed).toBeTruthy();
  expect(internals(foo).refCount).toBe(0);

  expect((): void => {
    foo.addRef();
  }).toThrowError();

  expect((): void => {
    foo.release();
  }).toThrowError();

  expect(destroy).toHaveBeenCalledTimes(1);
  expect(internals(foo).destroyed).toBeTruthy();
  expect(internals(foo).refCount).toBe(0);
});

test("refcounted", (): void => {
  let item = "foobar";

  let destroy = jest.fn();
  let refcounted = new RefCounted(item, destroy);

  expect(refcounted.get()).toBe("foobar");
  expect(destroy).not.toHaveBeenCalled();
  expect(internals(refcounted).destroyed).toBeFalsy();
  expect(internals(refcounted).refCount).toBe(1);

  expect(refcounted.addRef()).toBe(refcounted);
  expect(refcounted.get()).toBe("foobar");
  expect(destroy).not.toHaveBeenCalled();
  expect(internals(refcounted).destroyed).toBeFalsy();
  expect(internals(refcounted).refCount).toBe(2);

  refcounted.release();
  expect(refcounted.get()).toBe("foobar");
  expect(destroy).not.toHaveBeenCalled();
  expect(internals(refcounted).destroyed).toBeFalsy();
  expect(internals(refcounted).refCount).toBe(1);

  refcounted.release();
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(internals(refcounted).destroyed).toBeTruthy();
  expect(internals(refcounted).refCount).toBe(0);

  expect((): void => {
    refcounted.addRef();
  }).toThrowError();

  expect((): void => {
    refcounted.release();
  }).toThrowError();

  expect((): void => {
    refcounted.get();
  }).toThrowError();

  expect(destroy).toHaveBeenCalledTimes(1);
  expect(internals(refcounted).destroyed).toBeTruthy();
  expect(internals(refcounted).refCount).toBe(0);
});

test("cache", async (): Promise<void> => {
  const assume = <T>(item: T | null): T => {
    if (item) {
      return item;
    }
    throw new Error("Bad");
  };

  let cache = new Cache<string, number>();

  let item = cache.take("test1", 5);
  expect(item.get()).toBe(5);
  expect(internals(item).refCount).toBe(1);

  let other = cache.take("test2", 27);
  expect(other.get()).toBe(27);
  expect(internals(other).refCount).toBe(1);

  let again = assume(cache.get("test1"));
  expect(again.get()).toBe(5);
  expect(internals(again).refCount).toBe(2);

  item.release();
  expect(internals(again).refCount).toBe(1);

  jest.runAllTimers();

  let again2 = assume(cache.get("test1"));
  expect(again2.get()).toBe(5);
  expect(internals(again2).refCount).toBe(2);

  expect(again).toBe(again2);
  again.release();
  again2.release();
  expect(internals(again2).refCount).toBe(0);
  expect(internals(again2).destroyed).toBeTruthy();

  again = assume(cache.get("test1"));
  expect(again.get()).toBe(5);
  expect(again).not.toBe(again2);
  expect(internals(again).refCount).toBe(1);

  again.release();
  expect(internals(again).refCount).toBe(0);

  jest.runAllTimers();

  let gone = cache.get("test1");
  expect(gone).toBeNull();
});
