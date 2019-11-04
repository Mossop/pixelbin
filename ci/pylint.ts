import stream from "stream";

import { LintInfo, python, VinylFile } from "./utils";
import { path } from "../base/config";
import through2 from "through2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lintFromPylint(message: any): LintInfo {
  return {
    column: message.column + 1,
    line: message.line,
    source: "pylint",
    code: message.symbol,
    message: message.message,
  };
}

export function pylintCheck(args?: string[]): stream.Transform {
  let files: Map<string, VinylFile> = new Map();

  return through2.obj((file: VinylFile, _: string, callback: () => void): void => {
    files.set(file.path, file);
    callback();
  }, function(callback: (e?: Error) => void): void {
    python([path("venv/bin/pylint"), ...(args ? args : []), "--exit-zero", "-f", "json", ...files.keys()]).then((stdout: string[]): void => {
      let data = JSON.parse(stdout.join("\n"));

      for (let lint of data) {
        let file = files.get(path(lint.path));
        if (file) {
          if (!file.lintResults) {
            file.lintResults = [];
          }

          file.lintResults.push(lintFromPylint(lint));
        } else {
          console.error(`Missing file for ${lint.path}`);
        }
      }

      for (let file of files.values()) {
        this.push(file);
      }
      callback();
    }, (e: Error) => {
      console.error(e);
      callback();
    });
  });
}
