import { Component } from "react";

import { Obj } from "../../../utils";
import { expect } from "../test-helpers";
import {
  makeProperty,
  proxy,
  Property,
  buildProxy,
  proxyReactState,
  ProxyMarker,
} from "./StateProxy";

test("property", (): void => {
  let obj = {
    a: 5,
  };

  let property = makeProperty(obj, "a");

  expect(property.get()).toBe(5);
  property.set(6);
  expect(property.get()).toBe(6);
});

test("proxy", (): void => {
  interface NotProxied {
    a: string;
    b: number;
  }

  interface InnerInterface {
    a: number;
    b: string;
  }

  interface TestInterface {
    a: number;
    b: number;
    c?: string;
    d: InnerInterface;
    e: NotProxied;
  }

  let obj: TestInterface = {
    a: 5,
    b: 6,
    c: "foobar",
    d: proxy({
      a: 6,
      b: "bar",
    }),
    e: {
      a: "baz",
      b: 8,
    },
  };

  let current = obj;

  let setter = jest.fn<void, [TestInterface]>((val: TestInterface): void => {
    obj = val;
  });

  let prop: Property<TestInterface> = {
    get(): TestInterface {
      return obj;
    },

    set: setter,
  };

  let prx = buildProxy(prop);

  expect(prx).toEqual({
    a: 5,
    b: 6,
    c: "foobar",
    d: {
      a: 6,
      b: "bar",
    },
    e: {
      a: "baz",
      b: 8,
    },
  });

  expect(obj).toBe(current);
  expect(Object.getOwnPropertyDescriptor(prx.d, "g")).toBeUndefined();
  expect(setter).not.toHaveBeenCalled();

  prx.a = 27;
  expect(setter).toHaveBeenCalledTimes(1);

  expect(prx).toEqual({
    a: 27,
    b: 6,
    c: "foobar",
    d: {
      a: 6,
      b: "bar",
    },
    e: {
      a: "baz",
      b: 8,
    },
  });

  expect(obj).not.toBe(current);
  expect(obj.d).toBe(current.d);
  expect(obj.e).toBe(current.e);

  setter.mockClear();
  current = obj;

  prx.d.b = "55";
  expect(setter).toHaveBeenCalledTimes(1);

  expect(prx).toEqual({
    a: 27,
    b: 6,
    c: "foobar",
    d: {
      a: 6,
      b: "55",
    },
    e: {
      a: "baz",
      b: 8,
    },
  });

  expect(obj).not.toBe(current);
  expect(obj.d).not.toBe(current.d);
  expect(obj.e).toBe(current.e);

  setter.mockClear();
  current = obj;

  expect("b" in prx).toBeTruthy();
  expect("g" in prx).toBeFalsy();

  expect(setter).not.toHaveBeenCalled();

  delete prx.c;

  expect(prx).toEqual({
    a: 27,
    b: 6,
    d: {
      a: 6,
      b: "55",
    },
    e: {
      a: "baz",
      b: 8,
    },
  });

  expect(setter).toHaveBeenCalledTimes(1);

  expect(obj).toEqual({
    a: 27,
    b: 6,
    d: expect.objectContaining({
      a: 6,
      b: "55",
    }),
    e: {
      a: "baz",
      b: 8,
    },
  });
});

test("proxy marker", (): void => {
  interface InnerInterface {
    a: number;
  }

  interface TestInterface {
    a: InnerInterface;
  }

  let obj: TestInterface = {
    a: proxy({
      a: 6,
    }),
  };

  let setter = jest.fn<void, [TestInterface]>((val: TestInterface): void => {
    obj = val;
  });

  let prop: Property<TestInterface> = {
    get(): TestInterface {
      return obj;
    },

    set: setter,
  };

  let prx = buildProxy(prop);

  expect(ProxyMarker in prx.a).toBeFalsy();
  expect((): void => {
    prx.a[ProxyMarker] = true;
  }).toThrowError();
  expect((): void => {
    delete prx.a[ProxyMarker];
  }).toThrowError();

  expect(Object.getOwnPropertyDescriptor(prx.a, ProxyMarker)).toBeUndefined();
});

test("react state", (): void => {
  interface InnerType {
    a: number;
    b: string;
    c?: boolean;
  }

  interface StateType {
    prop: InnerType;
  }

  let setter = jest.fn<void, [Partial<StateType>]>();
  let fakeComponent = {
    setState: setter,
    state: {
      prop: {
        a: 6,
        b: "foobar",
      },
    },
  } as unknown as Component<Obj, StateType>;

  let prx = proxyReactState(fakeComponent, "prop");

  expect(prx.a).toBe(6);
  expect(prx.b).toBe("foobar");
  expect("c" in prx).toBeFalsy();

  expect(setter).not.toHaveBeenCalled();

  prx.a = 8;

  expect(setter).toHaveBeenCalledTimes(1);
  expect(setter).toHaveBeenLastCalledWith({
    prop: {
      a: 8,
      b: "foobar",
    },
  });

  prx.b = "banana";

  expect(setter).toHaveBeenCalledTimes(2);
  expect(setter).toHaveBeenLastCalledWith({
    prop: {
      a: 8,
      b: "banana",
    },
  });

  prx.c = true;

  expect(setter).toHaveBeenCalledTimes(3);
  expect(setter).toHaveBeenLastCalledWith({
    prop: {
      a: 8,
      b: "banana",
      c: true,
    },
  });

  expect("c" in prx).toBeTruthy();
});
