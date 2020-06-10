import pino from "pino";

import { MasterInterface, ServerInterface } from "../shared/comms";
import { MasterProcess } from "../shared/ipc/master";

const logger = pino({
  name: "server",
  level: "trace",
  base: {
    pid: process.pid,
  },
});

function main(): void {
  logger.info("Server startup.");

  new MasterProcess<MasterInterface, ServerInterface>({
    localInterface: {
      serve(): void {
        // foo
      },
    },
    requestDecoders: {},
    responseDecoders: {},
  });
}

main();

