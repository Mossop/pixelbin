const { spawn } = require("child_process");
const stream = require("stream");

const through2 = require("through2");

/**
 * @typedef { import("stream").Transform } Transform
 * @typedef { import("through2").TransformCallback } TransformCallback
 * @typedef { import("./types").VinylFile } VinylFile
 * @typedef { import("./types").LintInfo } LintInfo
 */

const PYTHON = "python3";

/**
 * @param {(chunk: VinylFile) => Promise<VinylFile>} passthrough
 * @return {Transform}
 */
exports.through = function(passthrough) {
  /**
   * @this {Transform}
   * @param {VinylFile} chunk
   * @param {string} _
   * @param {TransformCallback} callback
   * @return {void}
   */
  function transform(chunk, _, callback) {
    passthrough(chunk).then(chunk => {
      callback(null, chunk);
    }, e => {
      console.error(e);
    });
  }

  return through2.obj(transform);
};

/**
 * @param {string} command
 * @param {string[]} args
 * @return {Promise<string[]>}
 */
exports.exec = function(command, args = []) {
  let callback = (resolve, reject) => {
    /** @type {string[]} */
    let output = [];

    let process = spawn(command, args, {
      shell: true,
    });

    if (process.stdout instanceof stream.Readable) {
      process.stdout.setEncoding("utf8");
      process.stdout.on("data", chunk => {
        output.push(...chunk.split("\n"));
      });
    }

    if (process.stderr instanceof stream.Readable) {
      process.stderr.setEncoding("utf8");
      process.stderr.on("data", chunk => {
        output.push(...chunk.split("\n"));
      });
    }

    process.on("exit", code => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}\n${output.join("\n")}`));
      } else {
        resolve(output);
      }
    });

    process.on("error", err => {
      reject(err);
    });
  };

  return new Promise(callback);
};

/**
 * @param {string[]} args
 * @return {Promise<string[]>}
 */
exports.python = function(args) {
  return exports.exec(PYTHON, args);
};

/**
 * @return {Transform}
 */
exports.logLints = function() {
  return exports.through(file => {
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
};
