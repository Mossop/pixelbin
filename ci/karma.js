const { promises: fs } = require("fs");

const { createCoverageMap } = require("istanbul-lib-coverage");
const { Server } = require("karma");

const { path } = require("../base/config");
const { karmaConfig } = require("../karma.conf");
const { ensureDir } = require("./utils");

/**
 * @typedef {import("./types").KarmaSpecResult} KarmaSpecResult
 */

/**
 * @return {Promise<void>}
 */
exports.karma = async function() {
  karmaConfig.singleRun = true;
  karmaConfig["coverageReporter"] = { type: "in-memory" };
  karmaConfig.reporters = karmaConfig.reporters ?? [];
  karmaConfig.reporters.push("coverage");
  karmaConfig.browsers = ["FirefoxHeadless", "ChromeHeadless", "SafariNative"];

  let coverage = createCoverageMap();

  await new Promise((resolve, reject) => {
    let server = new Server(karmaConfig, exitCode => {
      if (exitCode != 0) {
        reject(new Error(`Karma exited with exit code ${exitCode}`));
      } else {
        resolve();
      }
    });

    server.on("coverage_complete", (browser, report) => {
      coverage.merge(report);
    });

    server.start();
  });

  let coverageFile = path("coverage", "karma-coverage.json");
  ensureDir(coverageFile);
  await fs.writeFile(coverageFile, JSON.stringify(coverage.toJSON()));
};
