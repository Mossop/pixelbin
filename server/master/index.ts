import child_process from "child_process";
import net from "net";
import path from "path";

import { ServerMasterInterface, ServerConfig } from "../shared/comms";
import { WorkerPool, AbstractChildProcess } from "../shared/ipc";
import getLogger from "../shared/logging";
import { listen } from "../shared/utility";
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

  let pool = new WorkerPool<undefined, ServerMasterInterface>({
    localInterface: {
      getServer: (): net.Server => server,
      getConfig: (): ServerConfig => ({
        staticRoot: path.resolve(path.join(__dirname, "..", "..", "..", "static")),
        appRoot: path.resolve(path.join(__dirname, "..", "..", "..", "build", "app")),
      }),
    },
    minWorkers: 4,
    maxWorkers: 8,
    fork: async (): Promise<AbstractChildProcess> => {
      logger.trace("Forking new process.");
      let server = path.join(basedir, "server", "index.js");
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
