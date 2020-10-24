import pino, { Bindings, Level, LevelWithSilent } from "pino";

type LogMethod = pino.LogFn;

export interface Logger {
  name: string;
  fatal: LogMethod;
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
  trace: LogMethod;
  isLevelEnabled: (level: string) => boolean;
  child: (bindings: Bindings) => Logger;
  catch: (promise: Promise<unknown>) => void;
  setLevel: (level: LevelWithSilent) => void;
}

function buildLogger(name: string, pinoLogger: pino.Logger): Logger {
  let logger = {
    name,
    isLevelEnabled: pinoLogger.isLevelEnabled.bind(pinoLogger),
    child: (bindings: Bindings): Logger => {
      let newName = bindings.name ?? name;
      return buildLogger(newName, pinoLogger.child(bindings));
    },
    catch: (promise: Promise<unknown>): void => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      promise.catch((err: any): void => {
        logger.warn(err, "Unexpected promise rejection.");
      });
    },
    setLevel: (level: LevelWithSilent): void => {
      pinoLogger["level"] = level;
    },
  } as unknown as Logger;

  for (let level of ["fatal", "error", "warn", "info", "debug", "trace"]) {
    logger[level] = (...args: unknown[]): void => {
      try {
        // @ts-ignore
        pinoLogger[level](...args);
      } catch (e) {
        pinoLogger.warn(e, "Failed to log message.");
      }
    };
  }

  let loggers = Loggers.get(name);
  loggers?.push(logger);

  return logger;
}

export interface LogConfig {
  default: LevelWithSilent;
  levels?: Record<string, Level>;
}

let Config: Required<LogConfig> = {
  default: process.env.NODE_ENV == "test" ? "silent" : "info",
  levels: {},
};

const Loggers = new Map<string, Logger[]>();

function getLoggerLevel(loggerName: string): LevelWithSilent {
  for (let [name, level] of Object.entries(Config.levels)) {
    if (loggerName == name || name.startsWith(loggerName + "/")) {
      return level;
    }
  }

  return Config.default;
}

export function setLogConfig(config: LevelWithSilent | LogConfig): void {
  if (typeof config == "string") {
    Config = {
      default: config,
      levels: {},
    };
  } else {
    Config = {
      default: config.default,
      levels: config.levels ?? {},
    };
  }

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
