import { MasterInterface, ServerInterface } from "../shared/comms";
import { MasterProcess } from "../shared/ipc/master";
import getLogger from "../shared/logging";

const logger = getLogger({
  name: "server",
  level: "trace",
});

function main(): void {
  logger.info("Server startup.");

  new MasterProcess<MasterInterface, ServerInterface>({
    localInterface: {
      serve(): void {
        logger.debug("Handling call to serve.");
      },
    },
    requestDecoders: {},
    responseDecoders: {},
  });
}

main();

