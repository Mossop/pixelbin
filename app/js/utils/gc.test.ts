import { RefCountedObject, RefCounted } from "./gc";

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
