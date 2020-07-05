import { Serializable, SendHandle } from "child_process";
import { EventEmitter } from "events";

import { mock, Mocked, awaitCall } from "../test-helpers";
import { AbstractChildProcess, WorkerProcess } from "./worker";

jest.useFakeTimers();

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

  interface Remote {
    foo: (val: number) => string;
    bar: (val: string) => number;
  }

  let localInterface = {

  };

  let worker = new WorkerProcess<Remote, typeof localInterface>({
    process: mockProcess,
    localInterface,
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
      methods: [],
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
