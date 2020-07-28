import { Serializable, SendHandle } from "child_process";
import { EventEmitter } from "events";

import { Mocked, mock, mockedClass, awaitCall, awaitEvent } from "../test-helpers";
import { defer, Deferred } from "../utils";
import { WorkerPool } from "./pool";
import { AbstractChildProcess, WorkerProcess, WorkerProcessOptions } from "./worker";

/* eslint-disable */
jest.mock("./worker", () => {
  return {
    __esModule: true,
    WorkerProcess: jest.fn(),
  };
});
/* eslint-enable */

jest.useFakeTimers();

const mockedWorkerProcess = mockedClass(WorkerProcess);

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

class MockWorker<R = unknown> extends EventEmitter {
  public deferredRemote: Deferred<R>;
  public kill: Mocked<WorkerProcess["kill"]>;
  public pid: number;

  public constructor(pid: number) {
    super();
    this.deferredRemote = defer<R>();
    this.kill = jest.fn((): Promise<void> => {
      this.emit("disconnect");
      return Promise.resolve();
    });
    this.pid = pid;
  }

  public get remote(): Promise<R> {
    return this.deferredRemote.promise;
  }
}

test("pool", async (): Promise<void> => {
  interface Call {
    worker: MockWorker<Remote>;
    val: number;
    result: Deferred<string>;
  }

  interface Remote {
    foo: (val: number) => Promise<string>;
  }

  let calls: Call[] = [];

  let nextId = 0;
  let workers: MockWorker<Remote>[] = [];
  let workerIds = (): number[] => workers.map((worker: MockWorker<Remote>): number => worker.pid);
  let callIds = (): number[] => calls.map((call: Call): number => call.worker.pid);

  mockedWorkerProcess.mockImplementation(
    (options: WorkerProcessOptions<unknown>): WorkerProcess<unknown, unknown> => {
      let worker = workers[options.process.pid];
      setImmediate((): void => {
        worker.emit("connect");
      });
      return worker as unknown as WorkerProcess<unknown, unknown>;
    },
  );

  let pool = new WorkerPool<Remote>({
    minWorkers: 0,
    maxWorkers: 3,

    fork: (): Promise<AbstractChildProcess> => {
      let process = new MockChildProcess();
      process.pid = nextId;
      let worker = new MockWorker<Remote>(nextId);
      worker.deferredRemote.resolve({
        foo: (val: number): Promise<string> => {
          let deferred = defer<string>();

          calls.push({
            worker,
            val,
            result: deferred,
          });

          worker.emit("task-start");
          void deferred.promise.then((): void => {
            worker.emit("task-end");
          }, (): void => {
            worker.emit("task-fail");
          });

          return deferred.promise;
        },
      });

      workers[nextId] = worker;
      nextId++;

      return Promise.resolve(process);
    },
  });

  expect(workers).toHaveLength(0);

  void (await pool.remote).foo(5);
  jest.runAllImmediates();
  // Workers: 0

  expect(workerIds()).toEqual([0]);
  expect(callIds()).toEqual([0]);

  let result2 = (await pool.remote).foo(78);
  jest.runAllImmediates();
  // Workers: 0, 1

  expect(workerIds()).toEqual([0, 1]);
  expect(callIds()).toEqual([0, 1]);

  void (await pool.remote).foo(8);
  jest.runAllImmediates();
  // Workers: 0, 1, 2

  expect(workerIds()).toEqual([0, 1, 2]);
  expect(callIds()).toEqual([0, 1, 2]);

  let result4 = (await pool.remote).foo(123);
  jest.runAllImmediates();
  // Workers: 0, 1, 2

  expect(workerIds()).toEqual([0, 1, 2]);
  expect(calls).toHaveLength(4);
  let reused = [calls[3].worker.pid];
  expect(reused[0]).toBeLessThan(3);
  expect(reused[0]).toBeGreaterThanOrEqual(0);

  let result5 = (await pool.remote).foo(152);
  jest.runAllImmediates();
  // Workers: 0, 1, 2

  expect(workerIds()).toEqual([0, 1, 2]);
  expect(calls).toHaveLength(5);
  reused[1] = calls[4].worker.pid;
  expect(reused[1]).toBeLessThan(3);
  expect(reused[1]).toBeGreaterThanOrEqual(0);
  expect(reused[1]).not.toBe(reused[0]);

  let result6 = (await pool.remote).foo(112);
  jest.runAllImmediates();
  // Workers: 0, 1, 2

  expect(workerIds()).toEqual([0, 1, 2]);
  expect(calls).toHaveLength(6);
  reused[2] = calls[5].worker.pid;
  expect(reused[2]).toBeLessThan(3);
  expect(reused[2]).toBeGreaterThanOrEqual(0);
  expect(reused[2]).not.toBe(reused[0]);
  expect(reused[2]).not.toBe(reused[1]);

  let expectedNext = calls[4].worker.pid;
  calls[4].result.resolve("foo");

  await expect(result5).resolves.toBe("foo");

  let result7 = (await pool.remote).foo(1152);
  jest.runAllImmediates();
  // Workers: 0, 1, 2

  expect(workerIds()).toEqual([0, 1, 2]);
  expect(calls).toHaveLength(7);
  expect(calls[6].worker.pid).toBe(expectedNext);

  calls[3].result.resolve("a");
  calls[5].result.resolve("b");
  calls[6].result.resolve("x");

  await expect(result4).resolves.toBe("a");
  await expect(result6).resolves.toBe("b");
  await expect(result7).resolves.toBe("x");

  jest.runAllTimers();

  expect(workers[1].kill).not.toHaveBeenCalled();

  calls[1].result.reject("oh no");
  await expect(result2).rejects.toBe("oh no");

  jest.runAllTimers();
  // Workers 0, 2

  expect(workers[1].kill).toHaveBeenCalledTimes(1);

  void (await pool.remote).foo(276);
  jest.runAllImmediates();
  // Workers 0, 2, 3

  expect(workerIds()).toEqual([0, 1, 2, 3]);

  workers[0].emit("disconnect");
  // Workers 2, 3

  let result9 = (await pool.remote).foo(76);
  jest.runAllImmediates();
  // Workers 2, 3, 4

  expect(workerIds()).toEqual([0, 1, 2, 3, 4]);
  expect(calls).toHaveLength(9);
  expect(calls[8].worker.pid).toBe(4);

  calls[8].result.resolve("bas");
  await expect(result9).resolves.toBe("bas");

  void (await pool.remote).foo(817);
  jest.runAllImmediates();
  // Workers 2, 3, 4
  expect(workerIds()).toEqual([0, 1, 2, 3, 4]);
  expect(calls).toHaveLength(10);
  expect(calls[9].worker.pid).toBe(4);

  jest.runAllTimers();

  expect(workers[4].kill).not.toHaveBeenCalled();

  let killed = Promise.all([
    awaitCall(workers[2].kill, Promise.resolve()),
    awaitCall(workers[3].kill, Promise.resolve()),
    awaitCall(workers[4].kill, Promise.resolve()),
  ]);
  pool.shutdown();

  await killed;
});

test("bad workers", async (): Promise<void> => {
  mockedWorkerProcess.mockImplementation(
    (_options: WorkerProcessOptions<unknown>): WorkerProcess<unknown, unknown> => {
      let worker = new MockWorker(0);
      setImmediate((): void => {
        worker.emit("disconnect");
      });
      return worker as unknown as WorkerProcess<unknown, unknown>;
    },
  );

  let nextId = 0;
  let pool = new WorkerPool({
    minWorkers: 0,
    maxWorkers: 3,

    fork: (): Promise<AbstractChildProcess> => {
      let process = new MockChildProcess();
      process.pid = nextId;
      return Promise.resolve(process);
    },
  });

  let shutdown = awaitEvent(pool, "shutdown");

  await expect(pool.remote).rejects.toThrow("disconnected before it connected");
  await expect(pool.remote).rejects.toThrow("disconnected before it connected");
  await expect(pool.remote).rejects.toThrow("disconnected before it connected");
  await expect(pool.remote).rejects.toThrow("disconnected before it connected");
  await expect(pool.remote).rejects.toThrow("disconnected before it connected");

  await shutdown;
});
