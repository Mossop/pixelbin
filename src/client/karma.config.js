const path = require("path");

const { constants } = require("karma");

const sourceWebpackConfig = require("./webpack.config")("test");

/** @type {import("webpack").Configuration} */
let webpackConfig = {
  ...sourceWebpackConfig,
};

delete webpackConfig.output;
delete webpackConfig.entry;

/** @type {import("karma").ConfigOptions} */
let karmaConfig = {
  basePath: __dirname,
  frameworks: ["jasmine"],
  files: [
    path.join(__dirname, "js", "**", "*.karma.ts"),
  ],
  exclude: [
  ],
  preprocessors: {
    "js/**/*": ["webpack"],
  },
  logLevel: constants.LOG_WARN,
  failOnEmptyTestSuite: false,
  webpack: webpackConfig,
  webpackMiddleware: {
    stats: "errors-warnings",
  },
  reporters: ["progress", "coverage-istanbul"],
  coverageIstanbulReporter: {
    combineBrowserReports: true,
    fixWebpackSourcePaths: true,
    dir: path.join(__dirname, "coverage"),
    reports: ["json"],
    "report-config": {
      json: {
        file: "coverage-karma.json",
      },
    },
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
