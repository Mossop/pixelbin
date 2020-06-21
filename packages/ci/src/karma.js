const { promises: fs } = require("fs");
const path = require("path");

const { mergeCoverage } = require("./coverage");
const { spawn } = require("./process");
const { findBin } = require("./utils");

/**
 * @typedef {import("./types").KarmaSpecResult} KarmaSpecResult
 */

/**
 * @param {string} root
 * @param {string} config
 * @return {() => Promise<void>}
 */
exports.karma = (root, config = path.join(root, "karma.conf.js")) => {
  /**
   * @return {Promise<void>}
   */
  return async function() {
    let karmaBin = await findBin(root, "karma");

    let exitCode = await spawn(karmaBin, [
      "start",
      config,
      "--singleRun",
    ], {
      cwd: root,
      shell: true,
      env: {
        ...process.env,

        // eslint-disable-next-line @typescript-eslint/naming-convention
        NODE_ENV: "test",
      },
    });

    if (exitCode != 0) {
      throw new Error(`Karma exited with exit code ${exitCode}`);
    }

    let coverages = await fs.readdir(path.join(root, "coverage", "karma"));
    await mergeCoverage(
      coverages.map(d => path.join(root, "coverage", "karma", d, "coverage.json")),
      path.join(root, "coverage", "karma-coverage.json"),
    );
  };
};
