import type { Deferred } from "./defer";
import { defer } from "./defer";
import { runTasks } from "./taskrunner";

test("taskrunner", async () => {
  let tasks: Deferred<void>[] = [
  ];

  let count = 0;
  let promise = runTasks(3, (): Promise<void> | null => {
    if (count >= 6) {
      return null;
    }

    tasks[count] = defer();
    return tasks[count++].promise;
  });

  expect(tasks).toHaveLength(3);

  tasks[1].resolve();
  await Promise.resolve();
  expect(tasks).toHaveLength(4);

  tasks[0].reject(new Error("Bad"));
  await Promise.resolve();
  expect(tasks).toHaveLength(5);

  tasks[4].resolve();
  await Promise.resolve();
  expect(tasks).toHaveLength(6);

  tasks[5].resolve();
  await Promise.resolve();
  expect(tasks).toHaveLength(6);

  tasks[2].resolve();
  await Promise.resolve();
  expect(tasks).toHaveLength(6);

  tasks[3].reject(new Error("Bad"));
  await Promise.resolve();
  expect(tasks).toHaveLength(6);

  await promise;
});
