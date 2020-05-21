/* eslint-env node */
const fs = require("fs").promises;

const { parallel } = require("gulp");
const sass = require("node-sass");
const webpack = require("webpack");

const { config, path } = require("./base/config");
const { eslint } = require("./ci/eslint");
const { pylint } = require("./ci/pylint");
const { typescript } = require("./ci/typescript");
const { ensureDir, logLint } = require("./ci/utils");
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
  /**
   * @param {LintedFile[]} files
   * @return {void}
   */
  function log(files) {
    files.map(file => file.lintResults.map(lint => logLint(file.path, lint)));
  }

  await Promise.all([
    eslint().then(log),
    pylint().then(log),
    typescript().then(log),
  ]);
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

exports.build = parallel(buildJs, buildCss);

exports.default = exports.build;
