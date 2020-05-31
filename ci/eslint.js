// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const { ESLint } = require("eslint");

const { path } = require("../base/config");
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
 * @type {() => AsyncIterable<LintedFile>}
 */
exports.eslint = iterable(async function(lints) {
  let eslint = new ESLint({
    cwd: path(),
    extensions: ["ts", "tsx", "js", "jsx"],
    globInputPaths: false,
  });
  /** @type {LintResult[]} */

  /**
   * @param {LintResult[]} results
   * @returns {void}
   */
  let results = await eslint.lintFiles(path());
  for (let result of results) {
    if (result.messages.length) {
      lints.push({
        path: result.filePath,
        lintResults: result.messages.map(lintFromLintMessage),
      });
    }
  }
});
