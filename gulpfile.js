/* eslint-env node */
const fs = require("fs").promises;

const { src, parallel } = require("gulp");
const mergeStreams = require("merge-stream");
const sass = require("node-sass");
const webpack = require("webpack");

const { config, path } = require("./base/config");
const { eslintCheck } = require("./ci/eslint");
const { pylintCheck } = require("./ci/pylint");
const { typeScriptCheck } = require("./ci/typescript");
const { logLints, ensureDir } = require("./ci/utils");
const webpackConfig = require("./webpack.config");

/**
 * @typedef { import("webpack").Stats } Stats
 * @typedef { import("node-sass").Options } SassOptions
 * @typedef { import("node-sass").Result } SassResult
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

const IGNORES = [
  "!base/**/*",
  "!build/**/*",
  "!node_modules/**/*",
  "!venv/**/*",
  "!public/**/*",
  "!api/migrations/**/*",
  "!coverage/**/*",
];

/**
 * @return {string[]}
 */
function allScripts() {
  return [
    "**/*.js",
    "**/*.jsx",
    "**/*.ts",
    "**/*.tsx",
    ...IGNORES,
  ];
}

/**
 * @return {NodeJS.ReadWriteStream}
 */
function pylint() {
  return src(["**/*.py", ...IGNORES])
    .pipe(pylintCheck([`--rcfile=${path(".pylintrc")}`]));
}

/**
 * @return {NodeJS.ReadWriteStream}
 */
function eslint() {
  return src(allScripts())
    .pipe(eslintCheck());
}

/**
 * @return {NodeJS.ReadWriteStream}
 */
function typescript() {
  return src([path("tsconfig.json"), ...allScripts()])
    .pipe(typeScriptCheck(path("tsconfig.json")));
}

/**
 * @return {NodeJS.ReadWriteStream}
 */
exports.lint = function() {
  return mergeStreams(pylint(), eslint(), typescript())
    .pipe(logLints());
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
