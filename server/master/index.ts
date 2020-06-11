import child_process from "child_process";
import net from "net";
import path from "path";

import { WorkerPool, AbstractChildProcess } from "../shared/ipc";
import getLogger from "../shared/logging";
import events from "./events";

const logger = getLogger({
  name: "master",
  level: "trace",
});

const basedir = path.dirname(path.resolve(__dirname));

function startupServers(): void {
  const server = net.createServer();
  server.listen(3000);
  logger.info("Listening on http://localhost:3000");

  let pool = new WorkerPool({
    localInterface: {
      getServer: (): net.Server => server,
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

  startupServers();
}

main();
