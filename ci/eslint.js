const { CLIEngine } = require("eslint");

const { through } = require("./utils");

/**
 * @typedef { import("stream").Transform } Transform
 * @typedef { import("eslint").Linter.LintMessage } LintMessage
 * @typedef { import("./utils").LintInfo } LintInfo
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
 * @return {Transform}
 */
exports.eslintCheck = function() {
  let linter = new CLIEngine({});

  return through(file => {
    let report = linter.executeOnFiles([file.path]);
    file.lintResults = report.results[0].messages.map(lintFromLintMessage);
    return Promise.resolve(file);
  });
};
