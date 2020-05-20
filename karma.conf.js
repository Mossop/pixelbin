const babelConfig = {
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

const webpackConfig = {
  mode: "development",
  resolve: {
    extensions: [".js", ".ts", ".tsx"],
  },
  devtool: "inline-source-map",
  module: {
    rules: [{
      test: /\.[jt]sx?$/,
      exclude: /node_modules|\.test\.[jt]sx?$/,
      use: [
        "@jsdevtools/coverage-istanbul-loader",
        {
          loader: "babel-loader",
          options: babelConfig,
        },
      ],
    }, {
      test: /\.karma\.test\.[jt]sx?/,
      exclude: /node_modules/,
      use: [{
        loader: "babel-loader",
        options: babelConfig,
      }],
    }],
  },
  externals: {
    "react": "React",
    "react-dom": "ReactDOM",
  },
};

module.exports = function(config) {
  config.set({
    basePath: "",
    frameworks: ["jasmine"],
    files: [
      "app/js/**/*.karma.ts",
    ],
    exclude: [
    ],
    preprocessors: {
      "app/js/**/*": ["webpack", "sourcemap"],
    },
    coverageIstanbulReporter: {
      dir: "coverage",
      reports: ["json"],
      fixWebpackSourcePaths: true,
    },
    webpack: webpackConfig,
    reporters: ["progress"],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ["Chrome"],
    singleRun: false,
    concurrency: 1,
  });
};
