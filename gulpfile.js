/* eslint-env node */
const { src, dest, series, parallel, watch } = require("gulp");
const gulpSass = require("gulp-sass");
const mergeStreams = require("merge-stream");
const named = require("vinyl-named");
const gulpWebpack = require("webpack-stream");

const { config, path } = require("./base/config");
const { eslintCheck } = require("./ci/eslint");
const { pylintCheck } = require("./ci/pylint");
const { typeScriptCheck } = require("./ci/typescript");
const { logLints } = require("./ci/utils");

/**
 * @typedef { import("webpack").Configuration } Configuration
 * @typedef { import("webpack").RuleSetQuery } RuleSetQuery
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
 * @return {RuleSetQuery}
 */
function babelOptions() {
  return {
    passPerPreset: true,
    plugins: [
      "@babel/plugin-proposal-class-properties",
      "@babel/plugin-proposal-optional-chaining",
      "@babel/plugin-proposal-nullish-coalescing-operator",
    ],
    presets: [
      [
        "@babel/preset-typescript", {
          isTSX: true,
          allExtensions: true,
        },
      ],
      ["@babel/preset-react"],
      [
        "@babel/preset-env", {
          targets: "defaults",
          useBuiltIns: "usage",
          corejs: 3,
        },
      ],
    ],
  };
}

/**
 * @return {Configuration}
 */
function buildJsConfig() {
  return {
    mode: config.general.debug ? "development" : "production",
    resolve: {
      extensions: [".js", ".ts", ".tsx"],
    },
    output: {
      publicPath: `${config.url.static}app/js/`,
      filename: "app.js",
      chunkFilename: "[name].js",
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: babelOptions(),
          },
        },
      ],
    },
    externals: {
      "react": "React",
      "react-dom": "ReactDOM",
    },
  };
}

/**
 * @return {Configuration}
 */
function watchJsConfig() {
  let config = buildJsConfig();
  config.watch = true;
  return config;
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
 * @return {void}
 */
exports.watchLint = function() {
  watch(["**/*.py", ...allScripts()], exports.lint);
};

/**
 * @return {NodeJS.ReadWriteStream}
 */
exports.watchBuildJs = function() {
  return src([path("app", "js", "bootstrap.tsx")])
    .pipe(named())
    .pipe(gulpWebpack(watchJsConfig()))
    .pipe(dest(path(config.path.build, "app", "js")));
};

/**
 * @return {NodeJS.ReadWriteStream}
 */
exports.buildJs = function() {
  return src([path("app", "js", "bootstrap.tsx")])
    .pipe(named())
    .pipe(gulpWebpack(buildJsConfig()))
    .pipe(dest(path(config.path.build, "app", "js")));
};

/**
 * @return {NodeJS.ReadWriteStream}
 */
exports.buildCss = function() {
  return src([path("app", "css", "app.scss")])
    .pipe(gulpSass().on("error", error => gulpSass.logError(error)))
    .pipe(dest(path(config.path.build, "app", "css")));
};

/**
 * @return {void}
 */
exports.watchBuildCss = function() {
  watch(["**/*.scss", ...IGNORES], exports.buildCss);
};

exports.build = parallel(exports.buildJs, exports.buildCss);
exports.watchBuild = series(
  exports.buildCss,
  parallel(exports.watchBuildJs, exports.watchBuildCss),
);

exports.default = exports.build;
