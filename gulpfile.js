/* eslint-env node */
const { src, dest, parallel } = require("gulp");
const gulpSass = require("gulp-sass");
const mergeStreams = require("merge-stream");
const webpack = require("webpack");

const { config, path } = require("./base/config");
const { eslintCheck } = require("./ci/eslint");
const { pylintCheck } = require("./ci/pylint");
const { typeScriptCheck } = require("./ci/typescript");
const { logLints } = require("./ci/utils");
const webpackConfig = require("./webpack.config");

/**
 * @typedef { import("webpack").Stats } Stats
 */

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
 * @return {NodeJS.ReadWriteStream}
 */
exports.buildCss = function() {
  return src([path("app", "css", "app.scss")])
    .pipe(gulpSass().on("error", error => gulpSass.logError(error)))
    .pipe(dest(path(config.path.build, "app", "css")));
};

exports.build = parallel(buildJs, exports.buildCss);

exports.default = exports.build;
