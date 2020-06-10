import child_process from "child_process";
import path from "path";
import { setInterval, clearInterval } from "timers";

import pino from "pino";

import { ServerInterface, MasterInterface } from "../shared/comms";
import { IntoPromises } from "../shared/ipc/meta";
import { WorkerPool } from "../shared/ipc/pool";
import { AbstractChildProcess } from "../shared/ipc/worker";

const logger = pino({
  name: "master",
  level: "trace",
  base: {
    pid: process.pid,
  },
});

const basedir = path.dirname(path.resolve(__dirname));

function main(): void {
  logger.info("Master startup.");

  let pool = new WorkerPool<ServerInterface, MasterInterface>({
    localInterface: {},
    requestDecoders: {},
    responseDecoders: {},
    minWorkers: 1,
    maxWorkers: 1,
    fork: async (): Promise<AbstractChildProcess> => {
      let server = path.join(basedir, "server", "index.js");
      return child_process.fork(server, [], {
        serialization: "advanced",
      });
    },
  });

  let interval = setInterval((): void => {
    void pool.remote.then((remote: IntoPromises<ServerInterface>): Promise<void> => {
      logger.info("Serve called.");
      return remote.serve();
    }).then((): void => {
      logger.info("Serve returned.");
    }, (error: unknown): void => {
      logger.error({ error }, "Serve threw exception.");
    });
  }, 1000);

  function quit(): void {
    clearInterval(interval);
    pool.quit();

    let quitTimeout = setTimeout((): void => {
      logger.warn("Forcibly quitting main process.");
      process.exit(0);
    }, 3000);

    quitTimeout.unref();
  }

  process.on("SIGTERM", (): void => {
    logger.info("Saw SIGTERM.");
    quit();
  });

  process.on("SIGINT", (): void => {
    logger.info("Saw SIGINT.");
    quit();
  });
}

main();
