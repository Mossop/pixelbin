type Task = () => void | Promise<void>;

interface TaskInfo {
  id: string;
  when: number;
  task: Task;
}

interface TaskTimeout {
  task: TaskInfo;
  timeout: NodeJS.Timeout;
}

export default class Scheduler {
  private timeout: TaskTimeout | null = null;
  private readonly pendingTasks: Map<string, TaskInfo> = new Map();

  private scheduleNext(): void {
    let minTask: TaskInfo | undefined;

    for (let task of this.pendingTasks.values()) {
      if (!minTask || minTask.when > task.when) {
        minTask = task;
      }
    }

    if (minTask === this.timeout?.task) {
      return;
    }

    if (this.timeout) {
      clearTimeout(this.timeout.timeout);
      this.timeout = null;
    }

    if (minTask) {
      let task = minTask;
      this.timeout = {
        task,
        timeout: setTimeout(() => {
          this.pendingTasks.delete(task.id);
          this.timeout = null;
          this.scheduleNext();
          void task.task();
        }, minTask.when - Date.now()),
      };
    }
  }

  public schedule(id: string, delay: number, task: Task): void {
    this.pendingTasks.set(id, {
      id,
      when: Date.now() + delay,
      task,
    });

    this.scheduleNext();
  }
}
