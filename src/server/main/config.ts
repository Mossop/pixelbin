import { promises as fs } from "fs";
import path from "path";

import type { Level, LevelWithSilent } from "pino";
import { JsonDecoder } from "ts.data.json";

import type { LogConfig } from "../../utils";
import { setLogConfig, MappingDecoder, oneOf } from "../../utils";
import type { CacheConfig } from "../cache";
import type { DatabaseConfig } from "../database";
import type { SmtpConfig } from "../email";
import type { StorageConfig } from "../storage";
import { serviceBuilder } from "./services";

export interface ServerConfig {
  database: DatabaseConfig;
  logging: LogConfig;
  storage: StorageConfig;
  cache: CacheConfig;
  smtp: SmtpConfig | null;
}

export interface ConfigFile {
  database: DatabaseConfig;
  logging?: LogConfig;
  storage?: string;
  cache: CacheConfig;
  smtp?: SmtpConfig;
}

const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
];

const LevelDecoder = MappingDecoder(JsonDecoder.string, (val: string): Level => {
  if (LOG_LEVELS.includes(val)) {
    return val as Level;
  }

  throw new Error(`${val} is not a valid log level.`);
}, "Level");

const LevelWithSilentDecoder = MappingDecoder(
  JsonDecoder.string,
  (val: string): LevelWithSilent => {
    if (val == "silent") {
      return val;
    }

    if (LOG_LEVELS.includes(val)) {
      return val as Level;
    }

    throw new Error(`${val} is not a valid log level.`);
  },
  "Level",
);

const LogConfigDecoder = oneOf<LogConfig>([
  MappingDecoder(LevelWithSilentDecoder, (level: LevelWithSilent): LogConfig => {
    return {
      default: level,
    };
  }, "LogConfig"),
  JsonDecoder.object<LogConfig>({
    default: LevelWithSilentDecoder,
    levels: JsonDecoder.optional(JsonDecoder.dictionary(LevelDecoder, "Levels")),
  }, "LogConfig"),
], "LogConfig");

const DatabaseConfigDecoder = JsonDecoder.object<DatabaseConfig>({
  username: JsonDecoder.string,
  password: JsonDecoder.string,
  host: JsonDecoder.string,
  port: JsonDecoder.optional(JsonDecoder.number),
  database: JsonDecoder.string,
}, "DatabaseConfig");

const CacheConfigDecoder = JsonDecoder.object<CacheConfig>({
  host: JsonDecoder.string,
  port: JsonDecoder.optional(JsonDecoder.number),
  namespace: JsonDecoder.optional(JsonDecoder.string),
}, "CacheConfig");

const SmtpConfigDecoder = JsonDecoder.object<SmtpConfig>({
  from: JsonDecoder.string,
  host: JsonDecoder.string,
  port: JsonDecoder.optional(JsonDecoder.number),
  ssl: JsonDecoder.optional(JsonDecoder.boolean),
  tls: JsonDecoder.optional(JsonDecoder.boolean),
}, "SmtpConfig");

const ConfigFileDecoder = JsonDecoder.object<ConfigFile>({
  database: DatabaseConfigDecoder,
  logging: JsonDecoder.optional(LogConfigDecoder),
  storage: JsonDecoder.optional(JsonDecoder.string),
  cache: CacheConfigDecoder,
  smtp: JsonDecoder.optional(SmtpConfigDecoder),
}, "ConfigFile");

async function findConfig(configTarget: string): Promise<string> {
  let target = path.resolve(configTarget);

  try {
    let stats = await fs.stat(target);
    if (stats.isDirectory()) {
      target = path.join(target, "pixelbin.json");
      stats = await fs.stat(target);
      if (!stats.isFile()) {
        throw new Error("Not a file.");
      }
    }

    return target;
  } catch (e) {
    throw new Error(`No configuration found at ${target}`);
  }
}

export const loadConfig = serviceBuilder(
  "config",
  async function loadConfig(configTarget: string = ""): Promise<ServerConfig> {
    let configFile = await findConfig(configTarget);
    let configRoot = path.dirname(configFile);

    let configContent: string;
    try {
      configContent = await fs.readFile(configFile, {
        encoding: "utf8",
      });
    } catch (e) {
      throw new Error(`Failed to read config file: ${e}`);
    }

    let configFileData: ConfigFile;
    try {
      configFileData = await ConfigFileDecoder.decodePromise(JSON.parse(configContent));
    } catch (e) {
      throw new Error(`Failed to parse config file: ${e}`);
    }

    let storage = configFileData.storage
      ? path.join(configRoot, configFileData.storage)
      : configRoot;
    let storageConfig: StorageConfig = {
      tempDirectory: path.join(storage, "temp"),
      localDirectory: path.join(storage, "local"),
    };

    let config: ServerConfig = {
      smtp: configFileData.smtp ?? null,
      storage: storageConfig,
      cache: configFileData.cache,
      database: configFileData.database,
      logging: configFileData.logging ?? {
        default: "warn",
      },
    };

    await fs.mkdir(config.storage.tempDirectory, {
      recursive: true,
    });
    await fs.mkdir(config.storage.localDirectory, {
      recursive: true,
    });

    setLogConfig(config.logging);

    return config;
  },
);
