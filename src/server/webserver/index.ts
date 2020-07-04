import { getLogger } from "../../utils";
import { ParentProcess } from "../../worker";
import { connect } from "../database";
import buildApp from "./app";
import { ParentProcessInterface } from "./interfaces";

const logger = getLogger("webserver");

async function main(): Promise<void> {
  logger.info("Server startup.");

  let connection = new ParentProcess<ParentProcessInterface>();
  let parent = await connection.remote;

  try {
    let { databaseConfig } = await parent.getConfig();
    connect(databaseConfig);

    await buildApp(parent);
  } catch (e) {
    connection.shutdown();
    throw e;
  }
}

main().catch((error: Error): void => {
  logger.error(error, "Server threw error while connecting.");
});
