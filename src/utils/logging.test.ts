import type { Writable } from "stream";

import type { Serialized } from "./logging";

test("Bindings", async () => {
  let log = jest.fn();
  let log2 = jest.fn();

  let now = 1000000;
  jest.spyOn(Date, "now").mockImplementation(() => now);

  const { Level, getLogger } = await import("./logging");

  let root = getLogger();
  expect(root.name).toBe("");
  expect(root.config.level).toBeUndefined();

  let child = root.child("foo");
  expect(child.name).toBe("foo");
  expect(child.config.level).toBeUndefined();

  root.name = "bar";
  expect(child.name).toBe("bar.foo");
  root.config.level = Level.Info;

  expect(root.isLevelEnabled(Level.Info)).toBeTruthy();
  expect(root.isLevelEnabled(Level.Warn)).toBeTruthy();
  expect(root.isLevelEnabled(Level.Debug)).toBeFalsy();

  child.config.level = Level.Warn;
  expect(child.isLevelEnabled(Level.Info)).toBeFalsy();
  expect(child.isLevelEnabled(Level.Warn)).toBeTruthy();
  expect(child.isLevelEnabled(Level.Debug)).toBeFalsy();

  child.config.level = Level.Debug;
  expect(child.isLevelEnabled(Level.Info)).toBeTruthy();
  expect(child.isLevelEnabled(Level.Warn)).toBeTruthy();
  expect(child.isLevelEnabled(Level.Debug)).toBeTruthy();

  let child2 = getLogger("foo");
  expect(child2).toBe(child);

  child2 = getLogger("baz");
  expect(child2.isLevelEnabled(Level.Info)).toBeTruthy();
  expect(child2.isLevelEnabled(Level.Warn)).toBeTruthy();
  expect(child2.isLevelEnabled(Level.Debug)).toBeFalsy();

  root.config.transport = {
    log,
  };

  child.config.transport = {
    log: log2,
  };

  root.debug("Hello");
  expect(log).not.toHaveBeenCalled();
  root.info("Hello");
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenLastCalledWith("bar", Level.Info, {
    time: 1000000,
    msg: "Hello",
    pid: process.pid,
  });
  log.mockClear();

  child.error("here");
  expect(log).not.toHaveBeenCalled();
  expect(log2).toHaveBeenCalledTimes(1);
  expect(log2).toHaveBeenLastCalledWith("bar.foo", Level.Error, {
    time: 1000000,
    msg: "here",
    pid: process.pid,
  });
  log2.mockClear();

  child2.warn("boo");
  expect(log2).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenLastCalledWith("bar.baz", Level.Warn, {
    time: 1000000,
    msg: "boo",
    pid: process.pid,
  });
  log.mockClear();

  root.bindings = {
    pid: 4000,
    host: "localhost",
  };

  root.info("Hello");
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenLastCalledWith("bar", Level.Info, {
    time: 1000000,
    msg: "Hello",
    pid: 4000,
    host: "localhost",
  });
  log.mockClear();

  child2.info("Oh no");
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenLastCalledWith("bar.baz", Level.Info, {
    time: 1000000,
    msg: "Oh no",
    pid: 4000,
    host: "localhost",
  });
  log.mockClear();

  let child3 = child2.withBindings({
    pid: 8000,
    something: "boyo",
  });

  child3.error("Overrode");
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenLastCalledWith("bar.baz", Level.Error, {
    time: 1000000,
    msg: "Overrode",
    pid: 8000,
    host: "localhost",
    something: "boyo",
  });
  log.mockClear();

  child3.warn({
    something: "box",
    other: "baz",
  }, "this one");
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenLastCalledWith("bar.baz", Level.Warn, {
    time: 1000000,
    msg: "this one",
    pid: 8000,
    host: "localhost",
    something: "box",
    other: "baz",
  });
  log.mockClear();

  let child4 = child2.child("deeper");
  child4.config.level = Level.Debug;

  let child5 = child3.child("deeper");
  expect(child5.config.level).toBe(Level.Debug);

  expect(child5).not.toBe(child4);

  child4.debug({
    pid: 2,
  }, "Let's see");
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenLastCalledWith("bar.baz.deeper", Level.Debug, {
    time: 1000000,
    msg: "Let's see",
    pid: 2,
    host: "localhost",
  });
  log.mockClear();

  child5.debug({
    pid: 2,
  }, "Let's see again");
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenLastCalledWith("bar.baz.deeper", Level.Debug, {
    time: 1000000,
    msg: "Let's see again",
    pid: 2,
    host: "localhost",
    something: "boyo",
  });
  log.mockClear();

  root.bindings = {};
  child5.debug({
    pid: 2,
  }, "Let's see again again");
  expect(log).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenLastCalledWith("bar.baz.deeper", Level.Debug, {
    time: 1000000,
    msg: "Let's see again again",
    pid: 2,
    something: "boyo",
  });
  log.mockClear();

  expect(getLogger("baz.deeper")).toBe(child4);
});

test("serializers", async () => {
  const { Serialize, serialize } = await import("./logging");

  expect(serialize(true)).toBe(true);
  expect(serialize("foo")).toBe("foo");
  expect(serialize(68)).toBe(68);
  expect(serialize(BigInt("456"))).toBe("456");
  expect(serialize(undefined)).toBe(undefined);
  expect(serialize(null)).toBe(null);
  expect(serialize(Symbol("hello"))).toBe("Symbol(hello)");

  expect(serialize(["2", 56, false])).toEqual(["2", 56, false]);
  expect(serialize({
    a: [5, 6],
    b: "56",
    c: false,
    d: null,
    e: undefined,
  })).toEqual({
    a: [5, 6],
    b: "56",
    c: false,
    d: null,
    e: undefined,
  });

  expect(serialize({
    a: 5,
    b: 6,
    [Serialize](): Serialized {
      return "done";
    },
  })).toBe("done");

  expect(serialize(new Error("Oh dear"))).toEqual({
    stack: expect.stringContaining("Oh dear"),
  });
});

test("ndjson", async () => {
  const { NDJsonTransport, getLogger, Level } = await import("./logging");

  let now = 1000000;
  jest.spyOn(Date, "now").mockImplementation(() => now);

  let output = jest.fn<void, [string]>();
  let transport = new NDJsonTransport({ write: output } as unknown as Writable);

  let root = getLogger();
  root.config.transport = transport;
  root.config.level = Level.All;
  root.bindings = {
    pid: 2000,
    host: "me",
  };
  root.name = "rootlog";

  root.info({
    bar: "baz",
    error: new Error("Hello"),
  }, "oh no!");

  expect(output).toHaveBeenCalledTimes(1);
  let str = output.mock.calls[0][0];
  expect(str.endsWith("\n")).toBeTruthy();

  expect(JSON.parse(str)).toEqual({
    time: 1000000,
    level: Level.Info,
    bar: "baz",
    pid: 2000,
    host: "me",
    error: {
      stack: expect.stringContaining("Hello"),
    },
    name: "rootlog",
    msg: "oh no!",
  });
});

test("console", async () => {
  const { ConsoleTransport, getLogger, Level } = await import("./logging");

  let now = 1000000;
  jest.spyOn(Date, "now").mockImplementation(() => now);

  let log = jest.fn<void, unknown[]>();
  let warn = jest.fn<void, unknown[]>();
  let error = jest.fn<void, unknown[]>();
  let transport = new ConsoleTransport({
    log,
    warn,
    error,
  } as unknown as Console);

  let root = getLogger();
  root.config.transport = transport;
  root.config.level = Level.All;
  root.bindings = {
    pid: 2000,
    host: "me",
  };
  root.name = "rootlog";

  let err = new Error("Hello");

  root.info({
    bar: "baz",
    error: err,
  }, "oh no!");

  expect(log).toHaveBeenCalledTimes(1);
  expect(warn).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();

  expect(log).toHaveBeenLastCalledWith(1000000, "INFO", "oh no!", {
    pid: 2000,
    host: "me",
    bar: "baz",
    error: err,
  });
  log.mockClear();

  root.error({ oh: "no" });

  expect(log).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledTimes(1);

  expect(error).toHaveBeenLastCalledWith(1000000, "ERROR", {
    pid: 2000,
    host: "me",
    oh: "no",
  });
  error.mockClear();
});

test("config", async () => {
  const { Level, getLogger, setLogConfig, LogConfigDecoder } = await import("./logging");

  let config = await LogConfigDecoder.decodePromise("debug");
  expect(config).toEqual({
    default: Level.Debug,
  });

  let root = getLogger();
  root.name = "outer";
  expect(root.config.level).toBeUndefined();
  let child = root.child("abc");
  expect(child.config.level).toBeUndefined();
  let child2 = child.child("def");
  expect(child2.config.level).toBeUndefined();
  let child3 = root.child("ghi");
  expect(child3.config.level).toBeUndefined();

  setLogConfig(config);

  expect(root.config.level).toBe(Level.Debug);
  expect(child.config.level).toBeUndefined();
  expect(child2.config.level).toBeUndefined();
  expect(child3.config.level).toBeUndefined();

  config = await LogConfigDecoder.decodePromise({
    default: "warn",
  });
  expect(config).toEqual({
    default: Level.Warn,
  });

  setLogConfig(config);

  expect(root.config.level).toBe(Level.Warn);
  expect(child.config.level).toBeUndefined();
  expect(child2.config.level).toBeUndefined();
  expect(child3.config.level).toBeUndefined();

  config = await LogConfigDecoder.decodePromise({
    default: "error",
    levels: {
      "ghi": "warn",
      "outer.abc": "info",
    },
  });
  expect(config).toEqual({
    default: Level.Error,
    levels: {
      "ghi": Level.Warn,
      "outer.abc": Level.Info,
    },
  });

  setLogConfig(config);

  expect(root.config.level).toBe(Level.Error);
  expect(child.config.level).toBe(Level.Info);
  expect(child2.config.level).toBeUndefined();
  expect(child3.config.level).toBeUndefined();
});
