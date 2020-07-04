import { getLogger } from "../../utils";
import { MasterProcess } from "../../worker";
import { connect } from "../database";
import buildApp from "./app";
import { MasterInterface } from "./interfaces";

const logger = getLogger("webserver");

async function main(): Promise<void> {
  logger.info("Server startup.");

  let connection = new MasterProcess<MasterInterface>();
  let master = await connection.remote;

  try {
    let { databaseConfig } = await master.getConfig();
    connect(databaseConfig);

    await buildApp(master);
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error(error, "Server threw error while connecting.");
});
