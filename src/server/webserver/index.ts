import { getLogger } from "../../utils";
import { connect } from "../database";
import { MasterProcess } from "../worker";
import buildApp from "./app";
import { MasterInterface } from "./types";

export type { WebserverConfig, MasterInterface } from "./types";
export * as Api from "../../model/api";

const logger = getLogger("webserver");

async function main(): Promise<void> {
  logger.info("Server startup.");

  let connection = new MasterProcess<MasterInterface>();
  let master = await connection.remote;

  try {
    let config = await master.getConfig();
    connect(config.database);

    let server = await master.getServer();

    let app = buildApp(config);
    app.listen(server);
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error(error, "Server threw error while connecting.");
});
