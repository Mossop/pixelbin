// @ts-ignore: @types/eslint isn't updated for eslint 7.
const { ESLint } = require("eslint");

const { iterable } = require("./utils");

/**
 * @typedef { import("stream").Transform } Transform
 * @typedef { import("eslint").Linter.LintMessage } LintMessage
 * @typedef { import("eslint").CLIEngine.LintResult } LintResult
 * @typedef { import("./types").LintedFile } LintedFile
 * @typedef { import("./types").LintInfo } LintInfo
 */

/**
 * @param {LintMessage} message
 * @return {LintInfo}
 */
function lintFromLintMessage(message) {
  return {
    column: message.column,
    line: message.line,
    source: "eslint",
    code: message.ruleId ?? "",
    message: message.message,
  };
}

/**
 * @param {string} path
 * @return {AsyncIterable<LintedFile>}
 */
exports.eslint = function(path) {
  return iterable(async function(lints) {
    /* eslint-disable */
    let eslint = new ESLint({
      cwd: path,
      extensions: ["ts", "tsx", "js", "jsx"],
      globInputPaths: false,
    });

    /** @type {LintResult[]} */
    let results = await eslint.lintFiles(path);
    for (let result of results) {
      if (result.messages.length) {
        lints.push({
          path: result.filePath,
          lintResults: result.messages.map(lintFromLintMessage),
        });
      }
    }
  });
}
