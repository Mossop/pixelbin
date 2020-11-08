import { promises as fs } from "fs";
import path from "path";

import { Process } from "./server/utils/process";

async function findBin(dir: string, name: string): Promise<string> {
  while (dir != "/") {
    let bin = path.join(dir, "node_modules", ".bin", name);
    try {
      await fs.stat(bin);
      return bin;
    } catch (e) {
      // Missing file.
    }
    dir = path.dirname(dir);
  }

  throw new Error(`Unable to find ${name} binary.`);
}

async function main(args: string[]): Promise<number> {
  let server = new Process(process.execPath, [
    path.join(__dirname, "server", "main"),
    ...args,
  ]);
  let pretty = new Process(await findBin(__dirname, "pino-pretty"));
  server.pipe(pretty);

  return server.exitCode;
}

main(process.argv.slice(2)).catch(console.error);
