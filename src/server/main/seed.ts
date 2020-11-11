import { promises as fs } from "fs";
import path from "path";

import { getLogger } from "../../utils";
import type { Seed } from "../database";
import { SeedDecoder } from "../database";
import type { SeedOptions } from "./cli";
import { quit } from "./events";
import Services from "./services";

const logger = getLogger("pixelbin");

export default async function seed(options: SeedOptions): Promise<void> {
  try {
    let file = path.resolve(options.file);
    logger.info(`Seeding database from ${options.file}`);

    let fileContent: string;
    try {
      fileContent = await fs.readFile(file, {
        encoding: "utf8",
      });
    } catch (e) {
      logger.error(e, `Failed to read seed file ${file}`);
      return;
    }

    let content: unknown;
    try {
      content = JSON.parse(fileContent);
    } catch (e) {
      logger.error(e, `Failed to parse seed file ${file}`);
      return;
    }

    let seed: Seed;
    try {
      seed = await SeedDecoder.decodePromise(content);
    } catch (e) {
      logger.error(e, `Failed to parse seed file ${file}`);
      return;
    }

    let connection = await Services.database;
    await connection.seed(seed);
  } finally {
    quit();
  }
}
