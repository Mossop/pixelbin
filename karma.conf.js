const { constants } = require("karma");
const webpack = require("webpack");

const babelConfig = require("./babel.config.json");
const { path } = require("./base/config");
const webpackConfig = require("./webpack.config");

/**
 * @typedef { import("webpack").RuleSetRule } RuleSetRule
 */

const babelConfigWithCoverage = {
  ...babelConfig,
};
babelConfigWithCoverage.plugins = [...babelConfig.plugins, "istanbul"];

/**
 * @param {string} test
 * @return {RuleSetRule | null}
 */
function findRule(test) {
  if (!webpackConfig.module) {
    return null;
  }

  for (let rule of webpackConfig.module.rules) {
    if (!rule.test) {
      continue;
    }

    if (typeof rule.test == "string" && rule.test == test) {
      return rule;
    }
    if (rule.test instanceof RegExp && rule.test.source == test) {
      return rule;
    }
  }

  return null;
}

webpackConfig.mode = "development";

let mainRule = findRule("\\.[jt]sx?$");
if (mainRule) {
  mainRule.use = {
    loader: "babel-loader",
    options: {
      plugins: ["istanbul"],
    },
  };
}

if (!webpackConfig.module) {
  webpackConfig.module = { rules: [] };
}

webpackConfig.module.rules.push({
  test: /\.karma\.[jt]sx?/,
  exclude: /node_modules/,
  use: [{
    loader: "babel-loader",
  }],
});
delete webpackConfig.output;
delete webpackConfig.entry;

if (!webpackConfig.plugins) {
  webpackConfig.plugins = [];
}

delete webpackConfig.devtool;
webpackConfig.plugins.push(new webpack.SourceMapDevToolPlugin({
  filename: null, // if no value is provided the sourcemap is inlined
  test: /\.[jt]sx?$/, // process .js and .ts files only
}));

/** @type {import("./ci/types").FullKarmaConfig} */
const karmaConfig = {
  basePath: path(),
  frameworks: ["jasmine"],
  files: [
    path("app", "js", "**", "*.karma.ts"),
  ],
  exclude: [
  ],
  preprocessors: {
    "app/js/**/*": ["webpack", "sourcemap"],
  },
  logLevel: constants.LOG_WARN,
  webpackMiddleware: {
    stats: "errors-warnings",
    logLevel: "warn",
  },
  failOnEmptyTestSuite: false,
  webpack: webpackConfig,
  reporters: ["progress"],
  port: 9876,
  colors: true,
  autoWatch: false,
  browsers: ["Chrome"],
  singleRun: false,
  concurrency: 1,
};

module.exports = function(config) {
  config.set(karmaConfig);
};

module.exports.karmaConfig = karmaConfig;
