import { Serializable, SendHandle } from "child_process";
import { EventEmitter } from "events";

import { mock, Mocked, awaitCall, awaitEvent, mockEvent } from "../test-helpers";
import { defer, Deferred } from "../utils";
import Channel from "./channel";
import { AbstractChildProcess, WorkerProcess } from "./worker";

/* eslint-disable */
jest.mock("./channel", () => {
  let realChannel = jest.requireActual("./channel").default;
  return {
    __esModule: true,
    default: {
      create: jest.fn((...args) => realChannel.create(...args)),
      connect: jest.fn((...args) => realChannel.connect(...args)),
    },
  };
});
/* eslint-enable */

jest.useFakeTimers();

interface Remote {
  foo: (val: number) => string;
  bar: (val: string) => number;
}

class MockChannel<R = unknown> extends EventEmitter {
  public close: Mocked<() => void>;
  public onMessage: Mocked<(message: unknown, handle: unknown) => void>;
  public readonly deferredRemote: Deferred<R>;

  public constructor() {
    super();
    this.close = jest.fn();
    this.onMessage = jest.fn();
    this.deferredRemote = defer<R>();
  }

  public get remote(): Promise<R> {
    return this.deferredRemote.promise;
  }
}

function mockConnect<R = unknown>(): MockChannel<R> {
  let channel = new MockChannel<R>();
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let connect = Channel.connect;
  if (jest.isMockFunction(connect)) {
    connect.mockReturnValueOnce(channel);
  }
  return channel;
}

class MockChildProcess extends EventEmitter {
  public send: Mocked<AbstractChildProcess["send"]>;
  public kill: Mocked<AbstractChildProcess["kill"]>;
  public disconnect: Mocked<AbstractChildProcess["disconnect"]>;
  public pid: number;

  public constructor() {
    super();
    this.send = mock<AbstractChildProcess["send"]>((
      message: Serializable,
      sendHandle?: SendHandle,
      callback?: (error: Error | null) => void,
    ): void => {
      if (callback) {
        callback(null);
      }
    });
    this.kill = mock<AbstractChildProcess["kill"]>();
    this.pid = 0;
    this.disconnect = mock<AbstractChildProcess["disconnect"]>();
  }
}

async function waitFor(
  fn: Mocked<AbstractChildProcess["send"]>,
): Promise<[Serializable, SendHandle | undefined]> {
  let args = await awaitCall(fn);
  if (args[2]) {
    args[2](null);
  }

  return [args[0], args[1]];
}

test("worker", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 2425;

  let worker = new WorkerProcess<Remote>({
    process: mockProcess,
  });
  let connected = jest.fn();
  worker.on("connect", connected);
  let taskStart = jest.fn();
  worker.on("task-start", taskStart);
  let taskEnd = jest.fn();
  worker.on("task-end", taskEnd);
  let taskFail = jest.fn();
  worker.on("task-fail", taskFail);

  expect(worker.pid).toBe(2425);

  expect(mockProcess.send).not.toHaveBeenCalled();

  let call = waitFor(mockProcess.send);
  mockProcess.emit("message", { type: "ready" });

  let args = await call;
  expect(args).toEqual([{
    type: "rpc",
    message: {
      type: "connect",
      methods: undefined,
    },
  },
  undefined]);

  expect(connected).not.toHaveBeenCalled();

  mockProcess.emit("message", {
    type: "rpc",
    message: {
      type: "connected",
      methods: ["foo", "bar"],
    },
  });

  let remote = await worker.remote;
  expect(connected).toHaveBeenCalledTimes(1);

  expect("foo" in remote).toBeTruthy();
  expect("bar" in remote).toBeTruthy();
  expect("baz" in remote).toBeFalsy();

  expect(taskStart).not.toHaveBeenCalled();
  expect(taskEnd).not.toHaveBeenCalled();
  expect(taskFail).not.toHaveBeenCalled();

  call = waitFor(mockProcess.send);
  let fooResult = remote.foo(5);

  let fooArgs = await call;
  expect(fooArgs).toEqual([{
    type: "rpc",
    message: {
      type: "call",
      id: expect.anything(),
      method: "foo",
      arguments: [5],
    },
  },
  undefined]);

  expect(taskStart).toHaveBeenCalledTimes(1);
  expect(taskEnd).not.toHaveBeenCalled();
  expect(taskFail).not.toHaveBeenCalled();

  mockProcess.emit("message", {
    type: "rpc",
    message: {
      type: "ack",
      id: fooArgs[0]["message"]["id"],
    },
  });

  call = waitFor(mockProcess.send);
  let barResult = remote.bar("foo");

  let barArgs = await call;
  expect(barArgs).toEqual([{
    type: "rpc",
    message: {
      type: "call",
      id: expect.anything(),
      method: "bar",
      arguments: ["foo"],
    },
  },
  undefined]);

  expect(taskStart).toHaveBeenCalledTimes(2);
  expect(taskEnd).not.toHaveBeenCalled();
  expect(taskFail).not.toHaveBeenCalled();

  mockProcess.emit("message", {
    type: "rpc",
    message: {
      type: "ack",
      id: barArgs[0]["message"]["id"],
    },
  });

  mockProcess.emit("message", {
    type: "rpc",
    message: {
      type: "return",
      id: barArgs[0]["message"]?.["id"],
      return: 7,
    },
  });

  await expect(barResult).resolves.toBe(7);

  expect(taskStart).toHaveBeenCalledTimes(2);
  expect(taskEnd).toHaveBeenCalledTimes(1);
  expect(taskFail).not.toHaveBeenCalled();

  mockProcess.emit("message", {
    type: "rpc",
    message: {
      type: "exception",
      id: fooArgs[0]["message"]["id"],
      error: new Error("bad result"),
    },
  });

  await expect(fooResult).rejects.toThrowError("bad result");

  expect(taskStart).toHaveBeenCalledTimes(2);
  expect(taskEnd).toHaveBeenCalledTimes(1);
  expect(taskFail).toHaveBeenCalledTimes(1);

  let dead = worker.kill();
  expect(mockProcess.disconnect).toHaveBeenCalledTimes(1);
  mockProcess.emit("disconnect");

  await dead;

  expect(mockProcess.kill).toHaveBeenCalledTimes(1);
});

test("connect timeout", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 24225;

  let worker = new WorkerProcess<Remote>({
    process: mockProcess,
  });

  let disconnected = jest.fn();
  worker.on("disconnect", disconnected);

  jest.runAllTimers();

  expect(disconnected).toHaveBeenCalledTimes(1);
  await expect(worker.remote).rejects.toThrow("Worker process connection timed out");
});

test("channel connect timeout", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 2575;

  let mockChannel = mockConnect();

  let worker = new WorkerProcess<Remote>({
    process: mockProcess,
  });

  let connected = mockEvent(worker, "connect");
  let disconnected = awaitEvent(worker, "disconnect");

  mockProcess.emit("message", { type: "ready" });

  mockChannel.emit("connection-timeout");

  await disconnected;

  expect(connected).not.toHaveBeenCalled();
});

test("channel message timeout", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 2575;

  let mockChannel = mockConnect<Remote>();

  let worker = new WorkerProcess<Remote>({
    process: mockProcess,
  });

  let connected = awaitEvent(worker, "connect");
  let disconnected = awaitEvent(worker, "disconnect");

  mockProcess.emit("message", { type: "ready" });

  mockChannel.deferredRemote.resolve();

  await connected;

  mockChannel.emit("message-timeout");

  await disconnected;
});

test("worker exit", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 2575;

  let mockChannel = mockConnect<Remote>();

  let worker = new WorkerProcess<Remote>({
    process: mockProcess,
  });

  let connected = awaitEvent(worker, "connect");
  let disconnected = awaitEvent(worker, "disconnect");

  mockProcess.emit("message", { type: "ready" });

  mockChannel.deferredRemote.resolve();

  await connected;

  mockProcess.emit("exit");

  await disconnected;
});

test("worker error", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 2575;

  let mockChannel = mockConnect<Remote>();

  let worker = new WorkerProcess<Remote>({
    process: mockProcess,
  });

  let connected = awaitEvent(worker, "connect");
  let disconnected = awaitEvent(worker, "disconnect");

  mockProcess.emit("message", { type: "ready" });

  mockChannel.deferredRemote.resolve();

  await connected;

  mockProcess.emit("error");

  await disconnected;
});
