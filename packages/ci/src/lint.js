const { ansi } = require("./ansi");
const { joined } = require("./utils");

/**
 * @param {import("./types").LintInfo} lint
 * @return {void}
 */
function logLint(lint) {
  const { line = 1, column = 1 } = lint;
  let position = String(line).padStart(4) + ":" + String(column).padEnd(3);
  console.log(
    `${ansi.gray(position)} ${lint.message} ${ansi.gray(lint.source + "(" + lint.code + ")")}`,
  );
}
exports.logLint = logLint;

/**
 * @param {AsyncIterable<import("./types").LintedFile>} lints
 * @return {Promise<boolean>}
 */
async function logLints(lints) {
  let fileCount = 0;
  let lintCount = 0;

  for await (let info of lints) {
    console.log(ansi.underline(info.path));
    fileCount++;
    for (let lint of info.lintResults) {
      lintCount++;
      logLint(lint);
    }
    console.log();
  }

  if (fileCount) {
    console.error(`Saw ${lintCount} lint issues across ${fileCount} files.`);
    return false;
  }

  return true;
}
exports.logLints = logLints;

/**
 * @param {AsyncIterable<import("./types").LintedFile>[]} lints
 * @return {() => Promise<void>}
 */
exports.linter = function(...lints) {
  return async function() {
    let succeeded = await logLints(joined(...lints));
    if (!succeeded) {
      throw new Error("Failed lint checks.");
    }
  };
};
