const { exec, iterable } = require("./utils");

/**
 * @typedef { import("./types").LintInfo } LintInfo
 * @typedef { import("./types").LintedFile } LintedFile
 */

const SYNTAX = /^([^:]*):(\d+):(\d+):\s+(?:error):\s+(.+)\s+\[(.+)\]$/;

/**
 * @type {() => AsyncIterable<LintedFile>}
 */
exports.mypy = iterable(async function(lints) {
  /** @type {Map<string, LintedFile>} */
  let files = new Map();

  let cmdLine = [
    "--show-column-numbers",
    "--show-error-codes",
    "--no-color-output",
    "--no-error-summary",
    "api",
    "app",
    "config",
  ];
  let stdout = await exec("mypy", cmdLine);

  for (let line of stdout) {
    line = line.trim();
    if (!line.length) {
      continue;
    }

    let matches = SYNTAX.exec(line);
    if (matches) {
      let path = matches[1];
      let file = files.get(path);
      if (!file) {
        file = {
          path,
          lintResults: [],
        };
        files.set(path, file);
      }

      file.lintResults.push({
        line: parseInt(matches[2]),
        column: parseInt(matches[3]),
        source: "mypy",
        message: matches[4],
        code: matches[5],
      });
    } else {
      throw new Error(`Failed to parse mypy output: "${line}"`);
    }
  }

  for (let file of files.values()) {
    lints.push(file);
  }
});
