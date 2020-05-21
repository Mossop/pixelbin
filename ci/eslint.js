// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
const { ESLint } = require("eslint");

const { path } = require("../base/config");

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
 * @return {Promise<LintedFile[]>}
 */
exports.eslint = async function() {
  let eslint = new ESLint({
    cwd: path(),
    extensions: ["ts", "tsx", "js", "jsx"],
    globInputPaths: false,
  });
  /** @type {LintResult[]} */
  let results = await eslint.lintFiles(path());

  return results.map(result => {
    return {
      path: result.filePath,
      lintResults: result.messages.map(lintFromLintMessage),
    };
  });
};
