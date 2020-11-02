import type { Logger } from "../../utils";
import { getLogger } from "../../utils";

const logger = getLogger("task-worker/task");

type Task<
  A extends unknown[] = unknown[],
  R = void,
> = (logger: Logger, ...args: A) => R | Promise<R>;

let nextId = 0;
export function bindTask<
  A extends unknown[],
  R = void,
>(task: Task<A, R>): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    let taskLogger = logger.child({
      task: task.name,
      instance: nextId++,
    });

    let start = Date.now();
    taskLogger.trace("Task start");
    try {
      let result = await task(taskLogger, ...args);
      taskLogger.trace({
        duration: Date.now() - start,
      }, "Task complete");
      return result;
    } catch (e) {
      taskLogger.error(e, "Task threw exception");
      throw e;
    }
  };
}
