const path = require("path");

const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

const ENV = process.env.NODE_ENV ?? "development";

/**
 * @typedef { import("webpack").Configuration } Configuration
 */

/** @type {import("webpack").RuleSetUse} */
const loaders = [{
  loader: "ts-loader",
  options: {
    transpileOnly: true,
    configFile: path.join(__dirname, "tsconfig.build.json"),
  },
}];

if (ENV == "test") {
  loaders.unshift("@jsdevtools/coverage-istanbul-loader");
}

loaders.unshift("cache-loader");

/** @type {Configuration} */
module.exports = {
  mode: ENV == "test" ? "development" : ENV,
  entry: path.join(__dirname, "js", "bootstrap.tsx"),
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
  output: {
    path: path.join(__dirname, "..", "..", "build", "client", "js"),
    publicPath: "/app/js/",
    filename: "app.js",
    chunkFilename: "[name].js",
  },
  stats: "errors-warnings",
  devtool: ENV == "test" ? "inline-source-map" : "source-map",
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
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: path.join(__dirname, "tsconfig.build.json"),
      },
    }),
  ],
};
