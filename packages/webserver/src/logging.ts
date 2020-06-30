import { getLogger, Logger } from "pixelbin-utils";

import { AppContext } from "./app";

export interface LoggingContext {
  logger: Logger;
}

const mainLogger = getLogger("webserver.request");

// eslint-disable-next-line @typescript-eslint/ban-types
let loggers = new WeakMap<object, Logger>();
let requestId = 0;

export default function(): Record<string, PropertyDescriptor> {
  return {
    logger: {
      get(this: AppContext): Logger {
        let logger = loggers.get(this);
        if (logger) {
          return logger;
        }

        logger = mainLogger.child({
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
