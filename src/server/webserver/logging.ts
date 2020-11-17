import type { Logger } from "../../utils";
import { getLogger } from "../../utils";
import type { AppContext, DescriptorsFor } from "./context";

export interface LoggingContext {
  readonly logger: Logger;
}

const mainLogger = getLogger("request");

let loggers = new WeakMap<AppContext, Logger>();
let requestId = 0;

export default function(): DescriptorsFor<LoggingContext> {
  return {
    logger: {
      get(this: AppContext): Logger {
        let logger = loggers.get(this);
        if (logger) {
          return logger;
        }

        logger = mainLogger.withBindings({
          id: requestId++,
          method: this.method,
          path: this.path,
        });

        loggers.set(this, logger);
        return logger;
      },
    },
  };
}
