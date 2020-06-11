import express from "express";
import expressLogger from "express-pino-logger";

import { ServerMasterInterface } from "../shared/comms";
import { MasterProcess } from "../shared/ipc";
import getLogger from "../shared/logging";

const logger = getLogger({
  name: "server",
  level: "trace",
});

async function main(): Promise<void> {
  logger.info("Server startup.");

  let connection = new MasterProcess<ServerMasterInterface>();
  let master = await connection.remote;

  try {
    let server = await master.getServer();

    let appLogger = expressLogger({
      logger,
    });
    let app = express();
    app.use(appLogger);

    app.get("/", (req, res): void => {
      res.send("Hello World");
    });

    app.listen(server);
    logger.info({ listening: server.listening }, "Listening.");
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  console.error(error);
  logger.error({ error }, "Server threw error while connecting.");
});
