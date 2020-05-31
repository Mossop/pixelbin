/* eslint-env node */
const fs = require("fs").promises;

const { series, parallel } = require("gulp");
const { createCoverageMap } = require("istanbul-lib-coverage");
const sass = require("node-sass");
const webpack = require("webpack");

const { config, path } = require("./base/config");
const { eslint } = require("./ci/eslint");
const { jest } = require("./ci/jest");
const { karma } = require("./ci/karma");
const { pylint } = require("./ci/pylint");
const { typescript } = require("./ci/typescript");
const { ensureDir, logLint, joined } = require("./ci/utils");
const webpackConfig = require("./webpack.config");

/**
 * @typedef { import("webpack").Stats } Stats
 * @typedef { import("node-sass").Options } SassOptions
 * @typedef { import("node-sass").Result } SassResult
 * @typedef { import("./ci/types").LintedFile } LintedFile
 */

/**
 * @param {SassOptions} options
 * @return {Promise<SassResult>}
 */
function cssRender(options) {
  return new Promise((resolve, reject) => {
    sass.render(options, (err, result) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (err) {
        reject(err.message);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * @return {Promise<void>}
 */
exports.lint = async function() {
  let fileCount = 0;
  let lintCount = 0;

  for await (let info of joined(eslint(), pylint(), typescript())) {
    fileCount++;
    for (let lint of info.lintResults) {
      lintCount++;
      logLint(info.path, lint);
    }
  }

  if (fileCount) {
    throw new Error(`Saw ${lintCount} lint issues across ${fileCount} files.`);
  }
};

/**
 * @return {Promise<void>}
 */
async function buildJs() {
  let compiler = webpack(webpackConfig);

  /** @type {Stats} */
  let stats = await new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (err) {
        reject(err);
      } else {
        resolve(stats);
      }
    });
  });

  console.log(stats.toString({
    colors: true,
  }));
}

/**
 * @return {Promise<void>}
 */
async function buildCss() {
  let fileTarget = path(config.path.build, "app", "css", "app.css");
  let mapTarget = path(config.path.build, "app", "css", "app.css.map");

  await ensureDir(fileTarget);

  let result = await cssRender({
    file: path("app", "css", "app.scss"),
    outFile: fileTarget,
    sourceMap: mapTarget,
  });

  await Promise.all([
    fs.writeFile(fileTarget, result.css),
    fs.writeFile(mapTarget, result.map),
  ]);
}

/**
 * @return {Promise<void>}
 */
async function mergeCoverage() {
  let map = createCoverageMap();
  for (let file of ["karma-coverage.json", "jest-coverage.json"]) {
    try {
      await fs.stat(path("coverage", file));
      map.merge(JSON.parse(await fs.readFile(path("coverage", file), {
        encoding: "utf8",
      })));
    } catch (e) {
      // Missing or bad file.
    }
  }

  await fs.writeFile(path("coverage", "coverage-final.json"), JSON.stringify(map.toJSON()));
}

exports.karma = series(karma, mergeCoverage);
exports.jest = series(jest, mergeCoverage);

exports.test = series(jest, karma, mergeCoverage);

exports.build = parallel(buildJs, buildCss);

exports.default = exports.build;
