const fs = require("fs").promises;
const path = require("path");

const { parallel, series } = require("gulp");
const sass = require("node-sass");
const { ensureDir, karma, jest, linter, tsLint, eslint, mergeCoverage } = require("pixelbin-ci");
const webpack = require("webpack");

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
 * @typedef { import("webpack").Stats } Stats
 * @typedef { import("node-sass").Options } SassOptions
 * @typedef { import("node-sass").Result } SassResult
 */

/**
 * @return {Promise<void>}
 */
async function buildJs() {
  const webpackConfig = require("./webpack.config");
  let compiler = webpack(webpackConfig);

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      console.log(stats.toString({
        colors: true,
      }));

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * @return {Promise<void>}
 */
async function buildCss() {
  let fileTarget = path.join(__dirname, "build", "css", "app.css");
  let mapTarget = path.join(__dirname, "build", "css", "app.css.map");

  await ensureDir(fileTarget);

  let result = await cssRender({
    file: path.join(__dirname, "css", "app.scss"),
    outFile: fileTarget,
    sourceMap: mapTarget,
  });

  await Promise.all([
    fs.writeFile(fileTarget, result.css),
    fs.writeFile(mapTarget, result.map),
  ]);
}

function mergeCoverageResults() {
  return mergeCoverage([
    path.join(__dirname, "coverage", "jest-coverage.json"),
    path.join(__dirname, "coverage", "karma-coverage.json"),
  ], path.join(__dirname, "coverage", "coverage-final.json"));
}

const karmaTest = karma(__dirname);
exports.karma = series(karmaTest, mergeCoverageResults);
const jestTest = jest(__dirname);
exports.jest = series(jestTest, mergeCoverageResults);

exports.build = parallel(buildJs, buildCss);
exports.test = series(jestTest, karmaTest, mergeCoverageResults);
exports.lint = linter(eslint(__dirname), tsLint(__dirname));
