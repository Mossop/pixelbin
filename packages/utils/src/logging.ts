import pino, { Bindings } from "pino";

type Level = "trace" | "debug" | "info" | "warn" | "error" | "silent";
export type Logger = Pick<pino.Logger, Level | "isLevelEnabled" | "setLevel"> & {
  child: (bindings: Bindings) => Logger;
};

function buildLogger(name: string, pinoLogger: pino.Logger): Logger {
  let child = pinoLogger.child.bind(pinoLogger);

  let logger = pinoLogger as unknown as Logger;
  logger.child = (bindings: Bindings): Logger => {
    return buildLogger(name, child(bindings));
  };

  let loggers = Loggers.get(name);
  loggers?.push(logger);

  return logger;
}

export interface LogConfig {
  default: Level;
  levels?: Record<string, Level>;
}

let Config: Required<LogConfig> = {
  default: process.env.NODE_ENV == "test" ? "silent" : "info",
  levels: {},
};

const Loggers = new Map<string, Logger[]>();

function getLoggerLevel(loggerName: string): Level {
  for (let [name, level] of Object.entries(Config.levels)) {
    if (loggerName == name || name.startsWith(loggerName + ".")) {
      return level;
    }
  }

  return Config.default;
}

export function setLogConfig(config: LogConfig): void {
  Config = {
    default: config.default,
    levels: config.levels ?? {},
  };

  for (let [name, loggers] of Loggers.entries()) {
    loggers.forEach((logger: Logger): void => {
      logger.setLevel(getLoggerLevel(name));
    });
  }
}

export function getLogger(name: string, options: pino.LoggerOptions = {}): Logger {
  let loggers = Loggers.get(name);
  if (loggers) {
    return loggers[0];
  }

  options = Object.assign(options, {
    base: Object.assign(options.base ?? {}, { pid: process.pid }),
    level: getLoggerLevel(name),
    name,
  });

  Loggers.set(name, []);
  let logger = buildLogger(name, pino(options));
  return logger;
}
