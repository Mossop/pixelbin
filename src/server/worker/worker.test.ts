import type { Serializable, SendHandle } from "child_process";
import { EventEmitter } from "events";

import type { Mocked } from "../../test-helpers";
import { mock, awaitCall, awaitEvent } from "../../test-helpers";
import type { Deferred } from "../../utils";
import { defer } from "../../utils";
import Channel from "./channel";
import type { AbstractChildProcess } from "./worker";
import { WorkerProcess } from "./worker";

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

  let workerPromise = WorkerProcess.attach<Remote>({
    process: mockProcess,
  });

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

  mockProcess.emit("message", {
    type: "rpc",
    message: {
      type: "connected",
      methods: ["foo", "bar"],
    },
  });

  let worker = await workerPromise;

  let taskStart = jest.fn();
  worker.on("task-start", taskStart);
  let taskEnd = jest.fn();
  worker.on("task-end", taskEnd);
  let taskFail = jest.fn();
  worker.on("task-fail", taskFail);

  expect(worker.pid).toBe(2425);

  expect("foo" in worker.remote).toBeTruthy();
  expect("bar" in worker.remote).toBeTruthy();
  expect("baz" in worker.remote).toBeFalsy();

  expect(taskStart).not.toHaveBeenCalled();
  expect(taskEnd).not.toHaveBeenCalled();
  expect(taskFail).not.toHaveBeenCalled();

  call = waitFor(mockProcess.send);
  let fooResult = worker.remote.foo(5);

  let fooArgs = await call;
  expect(fooArgs).toEqual([{
    type: "rpc",
    message: {
      type: "call",
      id: expect.anything(),
      method: "foo",
      arguments: [5],
      handleArgument: null,
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
  let barResult = worker.remote.bar("foo");

  let barArgs = await call;
  expect(barArgs).toEqual([{
    type: "rpc",
    message: {
      type: "call",
      id: expect.anything(),
      method: "bar",
      arguments: ["foo"],
      handleArgument: null,
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
  mockProcess.emit("exit");

  await dead;

  expect(mockProcess.kill).toHaveBeenCalledTimes(0);
});

test("connect timeout", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 24225;

  let workerPromise = WorkerProcess.attach<Remote>({
    process: mockProcess,
  });

  jest.runAllTimers();

  await expect(workerPromise).rejects.toThrow("Worker process connection timed out");
});

test("channel connect timeout", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 2575;

  let mockChannel = mockConnect();

  let workerPromise = WorkerProcess.attach<Remote>({
    process: mockProcess,
  });

  mockProcess.emit("message", { type: "ready" });

  mockChannel.emit("connection-timeout");
  mockChannel.deferredRemote.reject(new Error("Channel connection timed out."));

  await expect(workerPromise).rejects.toThrow("Channel connection timed out.");
});

test("channel message timeout", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 2575;

  let mockChannel = mockConnect<Remote>();

  let workerPromise = WorkerProcess.attach<Remote>({
    process: mockProcess,
  });

  mockProcess.emit("message", { type: "ready" });

  mockChannel.deferredRemote.resolve(undefined as unknown as Remote);

  let worker = await workerPromise;
  let disconnected = awaitEvent(worker, "disconnect");

  mockChannel.emit("message-timeout");

  await disconnected;
});

test("worker exit", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 2575;

  let mockChannel = mockConnect<Remote>();

  let workerPromise = WorkerProcess.attach<Remote>({
    process: mockProcess,
  });

  mockProcess.emit("message", { type: "ready" });

  mockChannel.deferredRemote.resolve(undefined as unknown as Remote);

  let worker = await workerPromise;
  let disconnected = awaitEvent(worker, "disconnect");

  mockProcess.emit("exit");

  await disconnected;
});

test("worker error", async (): Promise<void> => {
  let mockProcess = new MockChildProcess();
  mockProcess.pid = 2575;

  let mockChannel = mockConnect<Remote>();

  let workerPromise = WorkerProcess.attach<Remote>({
    process: mockProcess,
  });

  mockProcess.emit("message", { type: "ready" });

  mockChannel.deferredRemote.resolve(undefined as unknown as Remote);

  let worker = await workerPromise;
  let disconnected = awaitEvent(worker, "disconnect");

  mockProcess.emit("error");

  await disconnected;
});
