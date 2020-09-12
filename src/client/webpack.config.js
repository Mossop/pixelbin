const path = require("path");

const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

/**
 * @typedef { import("webpack").Configuration } Configuration
 */

/** @type {(mode?: "test" | "development" | "production") => Configuration} */
module.exports = (mode = "development") => {
  /** @type {import("webpack").RuleSetUse} */
  const loaders = [{
    loader: "ts-loader",
    options: {
      transpileOnly: true,
      configFile: path.join(__dirname, "..", "tsconfig.client.json"),
    },
  }];

  if (mode == "test") {
    loaders.unshift("@jsdevtools/coverage-istanbul-loader");
  }

  loaders.unshift("cache-loader");

  return {
    mode: mode == "test" ? "development" : mode,
    entry: {
      app: path.join(__dirname, "bootstrap.tsx"),
    },
    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
    output: {
      path: path.join(__dirname, "..", "..", "build", "client"),
      publicPath: "/app/",
      filename: "[name].js",
      chunkFilename: "[name].js",
    },
    stats: "errors-warnings",
    devtool: mode == "test" ? "inline-source-map" : "source-map",
    module: {
      rules: [{
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: loaders,
      }],
    },
    externals: {
      "react": "React",
      "react-dom": "ReactDOM",
      "moment": "moment",
      "moment-timezone": "moment",
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: path.join(__dirname, "..", "tsconfig.client.json"),
        },
      }),
    ],
  };
};
