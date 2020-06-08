import { WorkerPool } from "../shared/ipc/pool";

export default function master(): void {
  let pool = new WorkerPool({
    minWorkers: 5,
    environment: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      CHILD_MODULE: "server",
    },
  });

  process.on("SIGTERM", (): void => {
    console.log(process.pid, "Saw SIGTERM.");
    pool.quit();
  });

  process.on("SIGINT", (): void => {
    console.log(process.pid, "Saw SIGINT.");
    pool.quit();
  });
}
