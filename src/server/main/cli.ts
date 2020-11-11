import type { Namespace } from "argparse";
import { Action, ArgumentParser } from "argparse";

import { getLogger } from "../../utils";
import { loadConfig } from "./config";
import seed from "./seed";
import serve from "./serve";
import { initDatabase, initStorage } from "./services";

const logger = getLogger("pixelbin");

export interface GlobalOptions {
}

export type SeedOptions = GlobalOptions & {
  file: string;
};

class SinglePositionalAction extends Action {
  public call(
    parser: ArgumentParser,
    namespace: Namespace,
    values: string | string[],
  ): void {
    // @ts-ignore
    namespace.file = values[0];
  }
}

export default function cli(args: string[]): void {
  let parser = new ArgumentParser({
    prog: "pixelbin",
  });

  parser.set_defaults({
    callback: serve,
  });

  parser.add_argument("--config", {
    nargs: 1,
    help: "The config file or directory to use. Defaults to the current directory.",
  });

  let commandParser = parser.add_subparsers({
    title: "subcommands",
  });

  let seedParser = commandParser.add_parser("seed", {
    help: "Seed the detabase with some data.",
  });

  seedParser.set_defaults({
    callback: seed,
  });

  seedParser.add_argument("file", {
    nargs: 1,
    action: SinglePositionalAction,
    help: "The file to seed the database with.",
  });

  let parsed = parser.parse_args(args);

  loadConfig(parsed.config);
  initDatabase();
  initStorage();

  parsed.callback(parsed).catch(logger.error);
}
