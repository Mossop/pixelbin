const fs = require("fs").promises;

const { createCoverageMap } = require("istanbul-lib-coverage");
const { createContext, getDefaultWatermarks } = require("istanbul-lib-report");
const { create: createReporter } = require("istanbul-reports");

const { ensureDir } = require("./utils");

/**
 * @param {string[]} files
 * @param {string} target
 * @return {Promise<void>}
 */
exports.mergeCoverage = async function mergeCoverage(files, target) {
  let map = createCoverageMap();
  for (let file of files) {
    try {
      await fs.stat(file);
      map.merge(JSON.parse(await fs.readFile(file, {
        encoding: "utf8",
      })));
    } catch (e) {
      // Missing or bad file.
    }
  }

  await ensureDir(target);
  await fs.writeFile(target, JSON.stringify(map.toJSON()));
};

/**
 * @template {keyof import("istanbul-reports").ReportOptions} T
 * @param {string} file
 * @param {T} name
 * @param {import("istanbul-reports").ReportOptions[T]} [options]
 * @return {Promise<void>}
 */
exports.reportCoverage = async function reportCoverage(file, name, options) {
  let data = JSON.parse(await fs.readFile(file, {
    encoding: "utf8",
  }));

  let coverageMap = createCoverageMap(data);
  let context = createContext({
    coverageMap,
    watermarks: getDefaultWatermarks(),
  });

  let reporter = createReporter(name, options);
  // @ts-ignore: Incorrect typings.
  reporter.execute(context);
};
