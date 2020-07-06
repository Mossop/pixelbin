import { defer, PromiseTracker } from "./defer";

jest.useFakeTimers();

test("defer", async (): Promise<void> => {
  let resolved = jest.fn();
  let rejected = jest.fn();

  let deferred = defer<string>();
  void deferred.promise.then(resolved, rejected);

  deferred.resolve("toobi");
  deferred.resolve("baz");
  deferred.reject(6);

  await deferred.promise.then((): number => 0, (): number => 0);

  expect(resolved).toHaveBeenCalledTimes(1);
  expect(resolved).toHaveBeenLastCalledWith("toobi");
  expect(rejected).not.toHaveBeenCalled();

  resolved.mockClear();

  deferred = defer<string>();
  void deferred.promise.then(resolved, rejected);

  deferred.reject(6);
  deferred.reject(7);
  deferred.resolve("toobi");
  deferred.resolve("baz");

  await deferred.promise.then((): number => 0, (): number => 0);

  expect(resolved).not.toHaveBeenCalled();
  expect(rejected).toHaveBeenCalledTimes(1);
  expect(rejected).toHaveBeenLastCalledWith(6);

  rejected.mockClear();
});

test("PromiseTracker", async (): Promise<void> => {
  let tracker = new PromiseTracker<number>();

  let { promise: promise1 } = tracker.defer();
  let settled1 = jest.fn();
  void promise1.then(settled1, settled1);

  let { id: id2, promise: promise2 } = tracker.defer();
  let settled2 = jest.fn();
  void promise2.then(settled2, settled2);

  let { id: id3, promise: promise3 } = tracker.defer();
  let settled3 = jest.fn();
  void promise3.then(settled3, settled3);

  tracker.resolve(id3, 56);

  await expect(promise3).resolves.toBe(56);

  expect(settled1).not.toHaveBeenCalled();
  expect(settled2).not.toHaveBeenCalled();
  expect(settled3).toHaveBeenCalledTimes(1);

  tracker.reject(id2, "foo");

  await expect(promise2).rejects.toBe("foo");

  expect(settled1).not.toHaveBeenCalled();
  expect(settled2).toHaveBeenCalledTimes(1);
  expect(settled3).toHaveBeenCalledTimes(1);

  tracker.rejectAll("555");

  await expect(promise1).rejects.toBe("555");

  expect(settled1).toHaveBeenCalledTimes(1);
  expect(settled2).toHaveBeenCalledTimes(1);
  expect(settled3).toHaveBeenCalledTimes(1);
});
