const { promises: fs } = require("fs");
const path = require("path");

const { createCoverageMap } = require("istanbul-lib-coverage");
const { createContext, getDefaultWatermarks } = require("istanbul-lib-report");
const { create: createReporter } = require("istanbul-reports");

/**
 * @param {string[]} files
 * @param {string} target
 * @return {Promise<void>}
 */
async function mergeCoverage(files, target) {
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

  await fs.mkdir(path.dirname(target), {
    recursive: true,
  });
  await fs.writeFile(target, JSON.stringify(map.toJSON()));
}

/**
 * @template {keyof import("istanbul-reports").ReportOptions} T
 * @param {string} file
 * @param {T} name
 * @param {import("istanbul-reports").ReportOptions[T]} [options]
 * @return {Promise<void>}
 */
async function reportCoverage(file, name, options) {
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
}

async function build() {
  let root = path.resolve(path.dirname(__dirname));

  return mergeCoverage([
    path.join(root, "coverage", "coverage-jest.json"),
    path.join(root, "coverage", "coverage-karma.json"),
  ], path.join(root, "coverage", "coverage-final.json"));
}

async function show() {
  let root = path.resolve(path.dirname(__dirname));

  return reportCoverage(
    path.join(root, "coverage", "coverage-final.json"),
    "text",
  );
}

if (process.argv[2] == "build") {
  build().catch(console.error);
} else {
  show().catch(console.error);
}
