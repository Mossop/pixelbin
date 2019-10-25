import stream from "stream";
import { spawn } from "child_process";

import through2 = require("through2");
import { TransformCallback } from "through2";
import { path } from "../base/config";

const PYTHON = path("venv", "bin", "python");

export interface VinylFile {
  path: string;
  lintResults?: LintInfo[];
}

export interface LintInfo {
  column?: number;
  line?: number;
  source: string;
  code: string;
  message: string;
}

export function through(passthrough: (chunk: VinylFile) => Promise<VinylFile>): stream.Transform {
  return through2.obj(function (this: stream.Transform, chunk: VinylFile, _: string, callback: TransformCallback): void {
    passthrough(chunk).then((chunk: VinylFile) => {
      callback(null, chunk);
    }, (e: Error) => {
      console.error(e);
    });
  });
}

export function exec(command: string, args: string[] = []): Promise<string[]> {
  return new Promise((resolve: (stdio: string[]) => void, reject: (err: Error) => void) => {
    let output: string[] = [];

    let process = spawn(command, args, {
      shell: true,
    });

    if (process.stdout instanceof stream.Readable) {
      process.stdout.setEncoding("utf8");
      process.stdout.on("data", (chunk: string): void => {
        output.push(...chunk.split("\n"));
      });
    }

    if (process.stderr instanceof stream.Readable) {
      process.stderr.setEncoding("utf8");
      process.stderr.on("data", (chunk: string): void => {
        output.push(...chunk.split("\n"));
      });
    }

    process.on("exit", (code: number) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}`));
      } else {
        resolve(output);
      }
    });

    process.on("error", (err: Error) => {
      reject(err);
    });
  });
}

export function python(args: string[]): Promise<string[]> {
  return exec(PYTHON, args);
}

export function logLints(): stream.Transform {
  return through((file: VinylFile): Promise<VinylFile> => {
    if (file.lintResults) {
      for (let result of file.lintResults) {
        const { line = 1, column = 1 } = result;
        console.log(`${file.path}:${line}:${column} ${result.source}(${result.code}) ${result.message}`);
      }
    }
    return Promise.resolve(file);
  });
}
