const { path } = require("../base/config");
const { exec } = require("./utils");

/**
 * @typedef { import("stream").Transform } Transform
 * @typedef { import("./types").LintInfo } LintInfo
 * @typedef { import("./types").LintedFile } LintedFile
 */

/**
 * @param {any} message
 * @return {LintInfo}
 */
function lintFromPylint(message) {
  return {
    column: message.column + 1,
    line: message.line,
    source: "pylint",
    code: message.symbol,
    message: message.message,
  };
}

/**
 * @return {Promise<LintedFile[]>}
 */
exports.pylint = async function() {
  /** @type {Map<string, LintedFile>} */
  let files = new Map();

  let cmdLine = [`--rcfile=${path(".pylintrc")}`, "--exit-zero", "-f", "json", "api", "config"];
  let stdout = await exec("pylint", cmdLine);

  /** @type {any} */
  let data;
  try {
    data = JSON.parse(stdout.join("\n"));
  } catch (e) {
    throw new Error(`Failed to parse pylint output: ${e}\n${stdout.join("\n")}`);
  }

  for (let lint of data) {
    let file = files.get(lint.path);
    if (!file) {
      file = {
        path: lint.path,
        lintResults: [],
      };
      files.set(lint.path, file);
    }

    file.lintResults.push(lintFromPylint(lint));
  }

  return [...files.values()];
};
