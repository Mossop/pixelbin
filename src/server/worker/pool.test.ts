import type { Serializable, SendHandle } from "child_process";
import { EventEmitter } from "events";

import type { Mocked } from "../../test-helpers";
import { mock, awaitCall, awaitEvent, mockedFunction } from "../../test-helpers";
import type { Deferred } from "../../utils";
import { defer } from "../../utils";
import { WorkerPool } from "./pool";
import type { AbstractChildProcess, WorkerProcessOptions } from "./worker";
import { WorkerProcess } from "./worker";

/* eslint-disable */
jest.mock("./worker", () => {
  return {
    __esModule: true,
    WorkerProcess: {
      attach: jest.fn(),
    },
  };
});
/* eslint-enable */

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedWorkerAttach = mockedFunction(WorkerProcess.attach);

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

class MockWorker<R = unknown> extends EventEmitter {
  public kill: Mocked<WorkerProcess["kill"]>;
  public pid: number;

  public constructor(pid: number, public readonly remote: R) {
    super();
    this.kill = jest.fn((): Promise<void> => {
      this.emit("disconnect");
      return Promise.resolve();
    });
    this.pid = pid;
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

  mockedWorkerAttach.mockImplementation(
    async (options: WorkerProcessOptions<unknown>): Promise<WorkerProcess<unknown, unknown>> => {
      return workers[options.process.pid] as unknown as WorkerProcess<unknown, unknown>;
    },
  );

  let pool = new WorkerPool<Remote>({
    minWorkers: 0,
    maxWorkers: 3,

    fork: (): Promise<AbstractChildProcess> => {
      let process = new MockChildProcess();
      process.pid = nextId;
      let worker = new MockWorker<Remote>(nextId, {
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
  expect(pool.runningTasks).toBe(0);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(0);

  void pool.remote.foo(5);
  let [count] = await awaitEvent(pool, "queue-length");
  // Workers: 0

  expect(workerIds()).toEqual([0]);
  expect(callIds()).toEqual([0]);
  expect(count).toBe(0);
  expect(pool.runningTasks).toBe(1);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(1);

  let result2 = pool.remote.foo(78);
  [count] = await awaitEvent(pool, "queue-length");
  // Workers: 0, 1

  expect(workerIds()).toEqual([0, 1]);
  expect(callIds()).toEqual([0, 1]);
  expect(count).toBe(0);
  expect(pool.runningTasks).toBe(2);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(2);

  void pool.remote.foo(8);
  [count] = await awaitEvent(pool, "queue-length");
  // Workers: 0, 1, 2

  expect(workerIds()).toEqual([0, 1, 2]);
  expect(callIds()).toEqual([0, 1, 2]);
  expect(count).toBe(0);
  expect(pool.runningTasks).toBe(3);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);

  let result4 = pool.remote.foo(123);
  [count] = await awaitEvent(pool, "queue-length");
  // Workers: 0, 1, 2

  expect(workerIds()).toEqual([0, 1, 2]);
  expect(calls).toHaveLength(4);
  expect(count).toBe(0);
  expect(pool.runningTasks).toBe(4);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);
  let reused = [calls[3].worker.pid];
  expect(reused[0]).toBeLessThan(3);
  expect(reused[0]).toBeGreaterThanOrEqual(0);

  let result5 = pool.remote.foo(152);
  [count] = await awaitEvent(pool, "queue-length");
  // Workers: 0, 1, 2

  expect(workerIds()).toEqual([0, 1, 2]);
  expect(calls).toHaveLength(5);
  expect(count).toBe(0);
  expect(pool.runningTasks).toBe(5);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);
  reused[1] = calls[4].worker.pid;
  expect(reused[1]).toBeLessThan(3);
  expect(reused[1]).toBeGreaterThanOrEqual(0);
  expect(reused[1]).not.toBe(reused[0]);

  let result6 = pool.remote.foo(112);
  [count] = await awaitEvent(pool, "queue-length");
  // Workers: 0, 1, 2

  expect(workerIds()).toEqual([0, 1, 2]);
  expect(calls).toHaveLength(6);
  expect(count).toBe(0);
  expect(pool.runningTasks).toBe(6);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);
  reused[2] = calls[5].worker.pid;
  expect(reused[2]).toBeLessThan(3);
  expect(reused[2]).toBeGreaterThanOrEqual(0);
  expect(reused[2]).not.toBe(reused[0]);
  expect(reused[2]).not.toBe(reused[1]);

  let expectedNext = calls[4].worker.pid;
  calls[4].result.resolve("foo");

  await expect(result5).resolves.toBe("foo");
  expect(pool.runningTasks).toBe(5);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);

  let result7 = pool.remote.foo(1152);
  [count] = await awaitEvent(pool, "queue-length");
  // Workers: 0, 1, 2

  expect(workerIds()).toEqual([0, 1, 2]);
  expect(calls).toHaveLength(7);
  expect(count).toBe(0);
  expect(pool.runningTasks).toBe(6);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);
  expect(calls[6].worker.pid).toBe(expectedNext);

  calls[3].result.resolve("a");
  calls[5].result.resolve("b");
  calls[6].result.resolve("x");

  await expect(result4).resolves.toBe("a");
  await expect(result6).resolves.toBe("b");
  await expect(result7).resolves.toBe("x");
  expect(pool.runningTasks).toBe(3);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);

  jest.runAllTimers();

  expect(workers[1].kill).not.toHaveBeenCalled();
  expect(pool.runningTasks).toBe(3);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);

  calls[1].result.reject("oh no");
  await expect(result2).rejects.toBe("oh no");

  jest.runAllTimers();
  // Workers 0, 2

  expect(workers[1].kill).toHaveBeenCalledTimes(1);
  expect(pool.runningTasks).toBe(2);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(2);

  void pool.remote.foo(276);
  [count] = await awaitEvent(pool, "queue-length");
  // Workers 0, 2, 3

  expect(workerIds()).toEqual([0, 1, 2, 3]);
  expect(count).toBe(0);
  expect(pool.runningTasks).toBe(3);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);

  workers[0].emit("disconnect");
  // Workers 2, 3

  let result9 = pool.remote.foo(76);
  [count] = await awaitEvent(pool, "queue-length");
  // Workers 2, 3, 4

  expect(workerIds()).toEqual([0, 1, 2, 3, 4]);
  expect(calls).toHaveLength(9);
  expect(count).toBe(0);
  expect(pool.runningTasks).toBe(4);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);
  expect(calls[8].worker.pid).toBe(4);

  calls[8].result.resolve("bas");
  await expect(result9).resolves.toBe("bas");
  expect(pool.runningTasks).toBe(3);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);

  void pool.remote.foo(817);
  [count] = await awaitEvent(pool, "queue-length");
  // Workers 2, 3, 4

  expect(workerIds()).toEqual([0, 1, 2, 3, 4]);
  expect(calls).toHaveLength(10);
  expect(count).toBe(0);
  expect(pool.runningTasks).toBe(4);
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(3);
  expect(calls[9].worker.pid).toBe(4);

  jest.runAllTimers();

  expect(workers[4].kill).not.toHaveBeenCalled();

  let killed = Promise.all([
    awaitCall(workers[2].kill, Promise.resolve()),
    awaitCall(workers[3].kill, Promise.resolve()),
    awaitCall(workers[4].kill, Promise.resolve()),
  ]);

  pool.shutdown();
  expect(pool.queueLength).toBe(0);
  expect(pool.workerCount).toBe(0);

  await killed;
});

test("bad workers", async (): Promise<void> => {
  interface Remote {
    foo: (val: number) => Promise<string>;
  }

  mockedWorkerAttach.mockImplementation(
    async (_options: WorkerProcessOptions<unknown>): Promise<WorkerProcess<unknown, unknown>> => {
      throw new Error("Worker failed to attach");
    },
  );

  let nextId = 0;
  let pool = new WorkerPool<Remote>({
    minWorkers: 0,
    maxWorkers: 3,

    fork: (): Promise<AbstractChildProcess> => {
      let process = new MockChildProcess();
      process.pid = nextId;
      return Promise.resolve(process);
    },
  });

  let shutdown = awaitEvent(pool, "shutdown");

  await expect(pool.remote.foo(5)).rejects.toThrow("Worker pool has shutdown.");

  await shutdown;
});

test("queue", async (): Promise<void> => {
  interface Remote {
    foo: (val: number) => Promise<string>;
  }

  interface Call {
    val: number;
    deferred: Deferred<string>;
  }

  let calls: Call[] = [];

  let worker = new MockWorker<Remote>(0, {
    foo: (val: number): Promise<string> => {
      worker.emit("task-start");

      let deferred = defer<string>();
      calls.push({ val, deferred });
      return deferred.promise.then((r: string): string => {
        worker.emit("task-end");
        return r;
      }, (e: unknown) => {
        worker.emit("task-fail");
        return Promise.reject(e);
      });
    },
  });

  mockedWorkerAttach.mockImplementationOnce(
    async (_options: WorkerProcessOptions<unknown>): Promise<WorkerProcess<unknown, unknown>> => {
      return worker as unknown as WorkerProcess<unknown, unknown>;
    },
  );

  let pool = new WorkerPool<Remote>({
    minWorkers: 0,
    maxWorkers: 1,
    maxTasksPerWorker: 2,

    fork: async (): Promise<AbstractChildProcess> => new MockChildProcess(),
  });

  expect(pool.workerCount).toBe(0);

  let qlEvent = awaitEvent(pool, "queue-length");

  void pool.remote.foo(1);
  let result1 = pool.remote.foo(2);
  let result2 = pool.remote.foo(3);
  let result3 = pool.remote.foo(4);
  void pool.remote.foo(5);

  let [count] = await qlEvent;
  expect(count).toBe(3);
  expect(pool.runningTasks).toBe(2);
  expect(pool.workerCount).toBe(1);
  expect(calls).toHaveLength(2);

  qlEvent = awaitEvent(pool, "queue-length");
  calls[1].deferred.resolve("hello");
  [count] = await qlEvent;
  expect(count).toBe(2);
  expect(pool.runningTasks).toBe(2);
  expect(pool.workerCount).toBe(1);
  expect(calls).toHaveLength(3);

  await expect(result1).resolves.toBe("hello");

  qlEvent = awaitEvent(pool, "queue-length");
  calls[2].deferred.resolve("boo");
  [count] = await qlEvent;
  expect(count).toBe(1);
  expect(pool.runningTasks).toBe(2);
  expect(pool.workerCount).toBe(1);
  expect(calls).toHaveLength(4);

  await expect(result2).resolves.toBe("boo");

  qlEvent = awaitEvent(pool, "queue-length");
  let result5 = pool.remote.foo(5);
  [count] = await qlEvent;
  expect(count).toBe(2);

  qlEvent = awaitEvent(pool, "queue-length");
  let result6 = pool.remote.foo(6);
  [count] = await qlEvent;
  expect(count).toBe(3);

  expect(pool.runningTasks).toBe(2);
  expect(pool.workerCount).toBe(1);
  expect(calls).toHaveLength(4);

  calls[3].deferred.resolve("baz");

  qlEvent = awaitEvent(pool, "queue-length");
  await expect(result3).resolves.toBe("baz");
  [count] = await qlEvent;
  expect(count).toBe(2);

  expect(pool.runningTasks).toBe(2);
  expect(pool.workerCount).toBe(1);
  expect(calls).toHaveLength(5);

  pool.shutdown();

  await expect(result5).rejects.toThrow("Worker pool has shutdown.");
  await expect(result6).rejects.toThrow("Worker pool has shutdown.");

  expect(pool.queueLength).toBe(0);
  // The two tasks already in progress won't get cancelled by our mock worker.
  expect(pool.runningTasks).toBe(2);
  expect(pool.workerCount).toBe(0);
});
