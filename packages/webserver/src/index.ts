import { ServerMasterInterface, getLogger } from "pixelbin-utils";
import { MasterProcess } from "pixelbin-worker";

import buildApp from "./app";

const logger = getLogger({
  name: "server",
  level: "trace",
});

async function main(): Promise<void> {
  logger.info("Server startup.");

  let connection = new MasterProcess<ServerMasterInterface>();
  let master = await connection.remote;

  try {
    let config = await master.getConfig();
    let server = await master.getServer();

    let app = buildApp(config);
    app.listen(server);
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error({ error }, "Server threw error while connecting.");
});
