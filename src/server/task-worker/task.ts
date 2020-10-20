import { getLogger, Logger } from "../../utils";

const logger = getLogger("task-worker/task");

type Task<A extends unknown[] = unknown[]> = (logger: Logger, ...args: A) => void | Promise<void>;

let nextId = 0;
export function bindTask<A extends unknown[]>(task: Task<A>): (...args: A) => Promise<void> {
  return async (...args: A): Promise<void> => {
    let taskLogger = logger.child({
      task: task.name,
      instance: nextId++,
    });

    let start = Date.now();
    taskLogger.trace("Task start");
    try {
      await task(taskLogger, ...args);
      taskLogger.trace({
        duration: Date.now() - start,
      }, "Task complete");
    } catch (e) {
      taskLogger.error(e, "Task threw exception");
    }
  };
}
