import type { Writable } from "stream";

import { JsonDecoder } from "ts.data.json";

import { MappingDecoder } from "./decoders";

export class NDJsonTransport implements Transport {
  public constructor(private readonly stream: Writable) {
  }

  public log(name: string, level: Level, bindings: Bindings): void {
    let logObj = Object.assign({}, bindings, {
      name,
      level,
    });

    let serialized = Object.fromEntries(
      Object.entries(logObj).map(([key, value]: [string, unknown]): [string, Serialized] => {
        return [key, serialize(value)];
      }),
    );

    this.stream.write(`${JSON.stringify(serialized)}\n`);
  }
}

export class ConsoleTransport implements Transport {
  public constructor(private readonly console: Console) {
  }

  public log(name: string, level: Level, bindings: Bindings): void {
    let method: "log" | "warn" | "error" = "log";
    if (level == Level.Warn) {
      method = "warn";
    } else if (level == Level.Error) {
      method = "error";
    }

    let {
      msg,
      time,
      ...params
    } = bindings;

    let args: unknown[] = [];
    if (time) {
      args.push(time);
    }

    args.push(Level[level].toLocaleUpperCase());

    if (msg) {
      args.push(msg);
    }

    args.push(params);

    this.console[method](...args);
  }
}

const NAME_SEPARATOR = ".";

export enum Level {
  All = 0,
  Trace = 10,
  Debug = 20,
  Info = 30,
  Warn = 40,
  Error = 50,
  Fatal = 60,
  Silent = 80,
}

export type Bindings = Record<string, unknown>;
export type Serialized =
  undefined |
  null |
  number |
  string |
  number |
  boolean |
  Serialized[] | {
    [K: string]: Serialized;
  };
export const Serialize = Symbol("Serialize");
export interface Serializable {
  [Serialize]: () => Serialized;
}
export function isSerializable(value: unknown): value is Serializable {
  // @ts-ignore
  return value && Serialize in value;
}

export function serialize(value: unknown): Serialized {
  if (Array.isArray(value)) {
    return value.map(serialize);
  }

  switch (typeof value) {
    case "boolean":
    case "number":
    case "string":
    case "undefined":
      return value;
    case "symbol":
    case "function":
    case "bigint":
      return value.toString();
  }

  if (value === null) {
    return value;
  }

  if (isSerializable(value)) {
    return value[Serialize]();
  }

  if (value instanceof Error && "stack" in value) {
    return {
      stack: value.stack,
    };
  }

  let valueObj = value as Record<string, unknown>;

  return Object.fromEntries(
    Object.entries(valueObj)
      .map(([key, value]: [string, unknown]): [string, Serialized] => [key, serialize(value)]),
  );
}

export interface Transport {
  log: (name: string, level: Level, bindings: Bindings) => void;
}

interface LogMethod {
  (bindings: Bindings, message?: string): void;
  (message: string): void;
}

export interface Logger {
  readonly name: string;
  readonly config: LoggerConfig;

  isLevelEnabled: (level: Exclude<Level, Level.Silent | Level.All>) => boolean;
  withBindings: (bindings: Bindings) => Logger;
  child: (name: string) => Logger;
  catch: (promise: Promise<unknown>) => void;

  fatal: LogMethod;
  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  debug: LogMethod;
  trace: LogMethod;
}

export interface RootLogger extends Logger {
  name: string;
  bindings: Bindings;
}

export interface LoggerConfig {
  level: Level | undefined;
  transport: Transport | undefined;
}

abstract class BaseLoggerConfigImpl implements LoggerConfig {
  public level: Level | undefined;
  public transport: Transport | undefined;
  public readonly children: Map<string, LoggerImpl>;

  public constructor() {
    this.children = new Map();
  }

  public abstract get effectiveNamePrefix(): string;

  public abstract get effectiveName(): string;

  public abstract get effectiveLevel(): Level;

  public abstract get effectiveTransport(): Transport | null;
}

class LoggerConfigImpl extends BaseLoggerConfigImpl {
  public constructor(
    private readonly parent: BaseLoggerConfigImpl,
    private readonly name: string,
  ) {
    super();
  }

  public get effectiveNamePrefix(): string {
    return this.effectiveName + NAME_SEPARATOR;
  }

  public get effectiveName(): string {
    return this.parent.effectiveNamePrefix + this.name;
  }

  public get effectiveLevel(): Level {
    return this.level ?? this.parent.effectiveLevel;
  }

  public get effectiveTransport(): Transport | null {
    return this.transport ?? this.parent.effectiveTransport;
  }
}

class RootLoggerConfigImpl extends BaseLoggerConfigImpl {
  public get effectiveNamePrefix(): string {
    if (rootLogger.name) {
      return rootLogger.name + NAME_SEPARATOR;
    }

    return "";
  }

  public get effectiveName(): string {
    return rootLogger.name;
  }

  public get effectiveLevel(): Level {
    return this.level ?? Level.Silent;
  }

  public get effectiveTransport(): Transport | null {
    return this.transport ?? null;
  }
}

function buildLogMethod(level: Level): LogMethod {
  function log(bindings: Bindings, message?: string): void;
  function log(message: string): void;
  function log(this: LoggerImpl, ...args: unknown[]): void {
    let bindings: Bindings;
    if (args.length == 2) {
      bindings = args[0] as Bindings;
      let message = args[1] as string | undefined;
      if (message) {
        bindings.msg = message;
      }
    } else if (typeof args[0] == "string") {
      bindings = {
        msg: args[0],
      };
    } else {
      bindings = args[0] as Bindings;
    }

    this.log(level, bindings);
  }

  return log;
}

abstract class BaseLoggerImpl implements Logger {
  public constructor(
    public readonly config: BaseLoggerConfigImpl,
  ) {
  }

  public abstract get name(): string;
  public abstract get bindings(): Bindings;

  public isLevelEnabled(level: Level): boolean {
    return this.config.effectiveLevel <= level;
  }

  public withBindings(bindings: Bindings): LoggerImpl {
    return new LoggerImpl(this.config, {
      ...this.bindings,
      ...bindings,
    });
  }

  public abstract child(name: string): LoggerImpl;

  public catch(promise: Promise<unknown>, level: Level = Level.Error): void {
    promise.catch((error: unknown) => {
      this.log(level, { error });
    });
  }

  public log(level: Level, bindings: Bindings): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    let transport = this.config.effectiveTransport;
    if (!transport) {
      return;
    }

    let loggedBindings = Object.assign(
      {},
      rootLogger.bindings,
      this.bindings,
      bindings,
    );

    if (!("time" in loggedBindings)) {
      loggedBindings.time = Date.now();
    }

    transport.log(this.config.effectiveName, level, loggedBindings);
  }

  public fatal: LogMethod = buildLogMethod(Level.Fatal);
  public error: LogMethod = buildLogMethod(Level.Error);
  public warn: LogMethod = buildLogMethod(Level.Warn);
  public info: LogMethod = buildLogMethod(Level.Info);
  public debug: LogMethod = buildLogMethod(Level.Debug);
  public trace: LogMethod = buildLogMethod(Level.Trace);
}

class LoggerImpl extends BaseLoggerImpl {
  public constructor(
    config: BaseLoggerConfigImpl,
    private readonly _bindings: Bindings | null,
  ) {
    super(config);
  }

  public get name(): string {
    return this.config.effectiveName;
  }

  public get bindings(): Bindings {
    return this._bindings ?? {};
  }

  public child(name: string): LoggerImpl {
    let child = this.config.children.get(name);
    if (!child) {
      child = new LoggerImpl(new LoggerConfigImpl(this.config, name), null);
      this.config.children.set(name, child);
    }

    if (this._bindings) {
      return child.withBindings(this._bindings);
    }
    return child;
  }
}

class RootLoggerImpl extends BaseLoggerImpl implements RootLogger {
  public bindings: Bindings;
  public name: string;

  public constructor() {
    super(new RootLoggerConfigImpl());
    this.bindings = {
      pid: process.pid,
    };
    this.name = "";
  }

  public child(name: string): LoggerImpl {
    let child = this.config.children.get(name);
    if (!child) {
      child = new LoggerImpl(new LoggerConfigImpl(this.config, name), null);
      this.config.children.set(name, child);
    }

    return child;
  }
}

const rootLogger = new RootLoggerImpl();

export function getLogger(): RootLogger;
export function getLogger(name: string): Logger;
export function getLogger(name?: string): Logger {
  let logger: Logger = rootLogger;

  if (name == undefined) {
    return logger;
  }

  let parts = name.split(NAME_SEPARATOR);
  let part = parts.shift();
  while (part) {
    logger = logger.child(part);
    part = parts.shift();
  }

  return logger;
}

export function setLogLevels(levels: Record<string, Level>): void {
  for (let [name, level] of Object.entries(levels)) {
    let parts = name.split(NAME_SEPARATOR);
    let part = parts.shift();
    if (part != rootLogger.name) {
      continue;
    }

    let logger = rootLogger;
    part = parts.shift();
    while (part) {
      logger = logger.child(part);
      part = parts.shift();
    }

    logger.config.level = level;
  }
}

export interface LogConfig {
  default: Level;
  levels?: Record<string, Level>;
}

export function setLogConfig(config: LogConfig): void {
  rootLogger.config.level = config.default;
  if (config.levels) {
    setLogLevels(config.levels);
  }
}

export const LevelDecoder = MappingDecoder(JsonDecoder.string, (val: string): Level => {
  if (val.length < 2) {
    throw new Error(`${val} is not a known log level.`);
  }

  let levelStr = val.charAt(0).toLocaleUpperCase() + val.substring(1).toLocaleLowerCase();
  if (!(levelStr in Level)) {
    throw new Error(`${val} is not a known log level.`);
  }

  return Level[levelStr] as Level;
}, "Level");

export const LogConfigDecoder = JsonDecoder.oneOf<LogConfig>([
  MappingDecoder(LevelDecoder, (level: Level): LogConfig => ({ default: level }), "Level"),
  JsonDecoder.object<LogConfig>({
    default: LevelDecoder,
    levels: JsonDecoder.optional(JsonDecoder.dictionary(LevelDecoder, "LogConfig.levels")),
  }, "LogConfig"),
], "LogConfig");
