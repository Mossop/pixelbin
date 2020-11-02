import Scheduler from "./scheduler";

jest.useFakeTimers();

test("scheduler", async () => {
  let scheduler = new Scheduler();

  let never = jest.fn();
  let first = jest.fn();
  let second = jest.fn();
  let third = jest.fn();
  let cancelled = jest.fn();

  scheduler.schedule("second", 200, second);
  scheduler.schedule("third", 300, third);
  scheduler.schedule("cancel2", 350, cancelled);
  scheduler.cancel("cancel2");
  scheduler.schedule("first", 10, never);
  scheduler.schedule("cancel1", 150, cancelled);
  scheduler.schedule("first", 100, first);

  jest.advanceTimersByTime(50);

  expect(never).toHaveBeenCalledTimes(0);
  expect(first).toHaveBeenCalledTimes(0);
  expect(second).toHaveBeenCalledTimes(0);
  expect(third).toHaveBeenCalledTimes(0);
  expect(cancelled).toHaveBeenCalledTimes(0);

  jest.advanceTimersByTime(70);

  expect(never).toHaveBeenCalledTimes(0);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(0);
  expect(third).toHaveBeenCalledTimes(0);
  expect(cancelled).toHaveBeenCalledTimes(0);

  scheduler.cancel("cancel1");

  jest.advanceTimersByTime(250);

  expect(never).toHaveBeenCalledTimes(0);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  expect(third).toHaveBeenCalledTimes(0);
  expect(cancelled).toHaveBeenCalledTimes(0);

  jest.advanceTimersByTime(350);

  expect(never).toHaveBeenCalledTimes(0);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  expect(third).toHaveBeenCalledTimes(1);
  expect(cancelled).toHaveBeenCalledTimes(0);

  jest.runAllTimers();

  expect(never).toHaveBeenCalledTimes(0);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
  expect(third).toHaveBeenCalledTimes(1);
  expect(cancelled).toHaveBeenCalledTimes(0);
});
