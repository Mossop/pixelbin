import { promises as fs } from "fs";
import path from "path";

import type { Level, LevelWithSilent } from "pino";
import { JsonDecoder } from "ts.data.json";

import type { LogConfig } from "../../utils";
import { MappingDecoder, oneOf } from "../../utils";
import type { CacheConfig } from "../cache";
import type { DatabaseConfig } from "../database";
import type { StorageConfig } from "../storage";

const basedir = path.resolve(path.join(__dirname, "..", ".."));

export interface ServerConfig {
  htmlTemplate: string;
  clientRoot: string;
  staticRoot: string;
  webserverPackage: string;
  taskWorkerPackage: string;
  database: DatabaseConfig;
  logging: LogConfig;
  storage: StorageConfig;
  cache: CacheConfig;
}

interface ConfigFile {
  htmlTemplate: string;
  clientRoot: string;
  staticRoot: string;
  database: DatabaseConfig;
  logging: LogConfig;
  storage: StorageConfig;
  cache: CacheConfig;
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

const StorageConfigDecoder = oneOf<StorageConfig>([
  MappingDecoder(JsonDecoder.string, (val: string): StorageConfig => {
    return {
      tempDirectory: path.join(val, "temp"),
      localDirectory: path.join(val, "local"),
    };
  }, "StorageConfig"),
  JsonDecoder.object({
    tempDirectory: JsonDecoder.string,
    localDirectory: JsonDecoder.string,
  }, "StorageConfig"),
], "StorageConfig");

const CacheConfigDecoder = JsonDecoder.object<CacheConfig>({
  host: JsonDecoder.string,
  port: JsonDecoder.optional(JsonDecoder.number),
  namespace: JsonDecoder.optional(JsonDecoder.string),
}, "CacheConfig");

const ConfigFileDecoder = JsonDecoder.object<ConfigFile>({
  htmlTemplate: JsonDecoder.string,
  clientRoot: JsonDecoder.string,
  staticRoot: JsonDecoder.string,
  database: DatabaseConfigDecoder,
  logging: LogConfigDecoder,
  storage: StorageConfigDecoder,
  cache: CacheConfigDecoder,
}, "ConfigFile");

export async function loadConfig(configFile: string): Promise<ServerConfig> {
  let configContent: string;

  try {
    configContent = await fs.readFile(configFile, {
      encoding: "utf8",
    });
  } catch (e) {
    throw new Error(`Failed to read config file: ${e}`);
  }

  let configRoot = path.dirname(path.resolve(configFile));

  let configFileData: ConfigFile;
  try {
    let parsed = JSON.parse(configContent);

    if (!parsed.storageConfig) {
      parsed.storageConfig = configRoot;
    }

    if (!parsed.logConfig) {
      parsed.logConfig = "info";
    }

    if (!parsed.clientRoot) {
      parsed.clientRoot = path.join(basedir, "client");
    }

    if (!parsed.htmlTemplate) {
      parsed.htmlTemplate = path.join(basedir, "index.html");
    }

    if (!parsed.staticRoot) {
      parsed.staticRoot = path.join(basedir, "static");
    }

    configFileData = await ConfigFileDecoder.decodePromise(parsed);
  } catch (e) {
    throw new Error(`Failed to parse config file: ${e}`);
  }

  let config: ServerConfig = {
    webserverPackage: path.join(basedir, "server", "webserver"),
    taskWorkerPackage: path.join(basedir, "server", "task-worker"),
    ...configFileData,
    storage: {
      tempDirectory: path.resolve(configRoot, configFileData.storage.tempDirectory),
      localDirectory: path.resolve(configRoot, configFileData.storage.localDirectory),
    },
  };

  await fs.mkdir(config.storage.tempDirectory, {
    recursive: true,
  });
  await fs.mkdir(config.storage.localDirectory, {
    recursive: true,
  });

  return config;
}
