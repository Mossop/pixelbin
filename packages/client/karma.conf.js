const path = require("path");

const { constants } = require("karma");

const sourceWebpackConfig = require("./webpack.config");

/** @type {import("webpack").Configuration} */
const webpackConfig = {
  ...sourceWebpackConfig,
};

delete webpackConfig.output;
delete webpackConfig.entry;

/**
 * @param {string} name
 * @return {string}
 */
function coverageDir(name) {
  return name.split(" ", 1)[0].toLocaleLowerCase();
}

/** @type {import("karma").ConfigOptions} */
const karmaConfig = {
  basePath: __dirname,
  frameworks: ["jasmine"],
  files: [
    path.join(__dirname, "src", "**", "*.karma.ts"),
  ],
  exclude: [
  ],
  preprocessors: {
    "src/**/*": ["webpack", "sourcemap"],
  },
  logLevel: constants.LOG_WARN,
  webpackMiddleware: {
    stats: "errors-warnings",
  },
  failOnEmptyTestSuite: false,
  webpack: webpackConfig,
  reporters: ["progress", "coverage"],
  coverageReporter: {
    type: "json",
    dir: "coverage/karma",
    subdir: coverageDir,
    file: "coverage.json",
  },
  colors: true,
  autoWatch: false,
  browsers: ["FirefoxHeadless", "ChromeHeadless", "SafariNative"],
  singleRun: false,
  concurrency: 1,
};

module.exports = function(config) {
  config.set(karmaConfig);
};

module.exports.karmaConfig = karmaConfig;
