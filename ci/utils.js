const { spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const stream = require("stream");

/**
 * @typedef { import("./types").LintInfo } LintInfo
 */

const PYTHON = "python3";

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
 * @param {string} file
 * @param {LintInfo} lint
 * @return {void}
 */
exports.logLint = function(file, lint) {
  const { line = 1, column = 1 } = lint;
  console.log(
    `${file}:${line}:${column} ${lint.source}(${lint.code}) ${lint.message}`,
  );
};

/**
 * @param {string} file
 * @return {Promise<void>}
 */
exports.ensureDir = async function(file) {
  await fs.mkdir(path.dirname(file), {
    recursive: true,
  });
};
