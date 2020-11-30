import { defer } from "./defer";

export async function runTasks(
  maxTasks: number,
  taskGenerator: () => Promise<void> | null,
): Promise<void> {
  if (maxTasks <= 0) {
    throw new Error("Cannot run any tasks if maxTasks is 0.");
  }

  let runningTasks = 0;
  let complete = defer();

  let startTask = (): void => {
    let task = taskGenerator();
    if (!task) {
      if (runningTasks == 0) {
        complete.resolve();
      }

      return;
    }

    runningTasks++;
    task
      .finally(() => {
        runningTasks--;
        startTask();
      })
      // Avoid unhandled promise rejections.
      .catch(() => null);
  };

  for (let i = 0; i < maxTasks; i++) {
    startTask();
  }

  return complete.promise;
}
