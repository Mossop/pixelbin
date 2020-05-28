const { path } = require("../base/config");
const { spawn } = require("./utils");

/**
 * @return {Promise<void>}
 */
exports.jest = async function() {
  let exitCode = await spawn(path("node_modules", ".bin", "jest"), [
    "--coverage",
    // `--reporters="${path("ci", "jest-reporter.js")}"`,
  ], {
    cwd: path(),
    shell: true,
  });

  if (exitCode != 0) {
    throw new Error(`Jest exited with exit code ${exitCode}`);
  }
};
