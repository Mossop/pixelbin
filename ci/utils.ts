import { spawn } from "child_process";
import stream from "stream";

import { TransformCallback } from "through2";

import through2 = require("through2");

const PYTHON = "python3";

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
  function transform(
    this: stream.Transform,
    chunk: VinylFile,
    _: string,
    callback: TransformCallback,
  ): void {
    passthrough(chunk).then((chunk: VinylFile): void => {
      callback(null, chunk);
    }, (e: Error): void => {
      console.error(e);
    });
  }

  return through2.obj(transform);
}

export function exec(command: string, args: string[] = []): Promise<string[]> {
  let callback = (resolve: (stdio: string[]) => void, reject: (err: Error) => void): void => {
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

    process.on("exit", (code: number): void => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}\n${output.join("\n")}`));
      } else {
        resolve(output);
      }
    });

    process.on("error", (err: Error): void => {
      reject(err);
    });
  };

  return new Promise(callback);
}

export function python(args: string[]): Promise<string[]> {
  return exec(PYTHON, args);
}

export function logLints(): stream.Transform {
  return through((file: VinylFile): Promise<VinylFile> => {
    if (file.lintResults) {
      for (let result of file.lintResults) {
        const { line = 1, column = 1 } = result;
        console.log(
          `${file.path}:${line}:${column} ${result.source}(${result.code}) ${result.message}`,
        );
      }
    }
    return Promise.resolve(file);
  });
}
