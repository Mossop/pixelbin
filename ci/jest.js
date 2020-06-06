const { path } = require("../base/config");
const { spawn } = require("./utils");

/**
 * @param {string} config
 * @return {() => Promise<void>}
 */
exports.jest = config => {
  return async function() {
    let exitCode = await spawn(path("node_modules", ".bin", "jest"), [
      "--config",
      config,
      "--coverage",
    ], {
      cwd: path(),
      shell: true,
    });

    if (exitCode != 0) {
      throw new Error(`Jest exited with exit code ${exitCode}`);
    }
  };
};

