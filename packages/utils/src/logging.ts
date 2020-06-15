import pino from "pino";

export type Logger = pino.Logger;

export function getLogger(options: pino.LoggerOptions): pino.Logger {
  let overrides: pino.LoggerOptions = {};

  if (process.env.NODE_ENV == "test") {
    overrides.level = process.env.LOG_LEVEL ?? "silent";
  }

  options = Object.assign({
    base: { pid: process.pid },
    level: "info",
  }, options, overrides);

  return pino(options);
}
