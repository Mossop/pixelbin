import Koa, { Context } from "koa";
import { getLogger, Logger } from "pixelbin-utils";

export interface LoggingContext {
  logger: Logger;
}

const mainLogger = getLogger("webserver.request");

// eslint-disable-next-line @typescript-eslint/ban-types
let loggers = new WeakMap<object, Logger>();

export default function<S, C>(app: Koa<S, C>): Koa<S, C & LoggingContext> {
  let requestId = 0;

  Object.defineProperties(app.context, {
    logger: {
      get(this: Context): Logger {
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
  });

  return app as unknown as Koa<S, C & LoggingContext>;
}

