import child_process from "child_process";
import net from "net";
import path from "path";

import { getLogger, listen } from "pixelbin-utils";
import type { MasterInterface, WebserverConfig } from "pixelbin-webserver";
import { WorkerPool, AbstractChildProcess } from "pixelbin-worker";

import config from "./config";
import events from "./events";

const logger = getLogger({
  name: "master",
  level: "trace",
});

const basedir = path.dirname(path.resolve(__dirname));

async function startupServers(): Promise<void> {
  const server = net.createServer();
  await listen(server, 8000);
  logger.info("Listening on http://localhost:8000");

  let pool = new WorkerPool<undefined, MasterInterface>({
    localInterface: {
      getServer: (): net.Server => server,
      getConfig: (): WebserverConfig => ({
        staticRoot: path.join(config.clientRoot, "static"),
        appRoot: path.join(config.clientRoot, "build"),
        database: config.database,
      }),
    },
    minWorkers: 4,
    maxWorkers: 8,
    fork: async (): Promise<AbstractChildProcess> => {
      logger.trace("Forking new process.");
      let server = path.join(path.join(basedir, "node_modules", "pixelbin-webserver"));
      return child_process.fork(server, [], {
        serialization: "advanced",
      });
    },
  });

  events.on("shutdown", (): void => {
    server.close();
    pool.shutdown();
  });
}

function main(): void {
  function quit(): void {
    events.emit("shutdown");

    let quitTimeout = setTimeout((): void => {
      logger.warn("Forcibly quitting main process.");
      process.exit(1);
    }, 5000);

    quitTimeout.unref();
  }

  process.on("SIGTERM", (): void => {
    quit();
  });

  process.on("SIGINT", (): void => {
    quit();
  });

  startupServers().catch((error: Error): void => {
    logger.error({ error }, "Server startup threw error.");
  });
}

main();