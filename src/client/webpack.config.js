const path = require("path");

const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackTagsPlugin = require("html-webpack-tags-plugin");

/**
 * @typedef {Object} External
 * @property {string} id
 * @property {string} variable
 * @property {string} version
 * @property {string} path
 */

/**
 * @type {External[]}
 */
const externals = require("./externals.json");

/**
 * @typedef { import("webpack").Configuration } Configuration
 */

/**
 * @returns {HtmlWebpackTagsPlugin.MaybeScriptTagOptions[]}
 */
function buildExternals() {
  return externals.map(pkg => ({
    type: "js",
    path: `https://unpkg.com/${pkg.id}@${pkg.version}/${pkg.path}`,
    publicPath: false,
    attributes: {
      crossorigin: true,
    },
    external: {
      packageName: pkg.id,
      variableName: pkg.variable,
    },
  }));
}

/** @type {(mode?: "test" | "development" | "production") => Configuration} */
module.exports = (mode = "development") => {
  /** @type {import("webpack").RuleSetUse} */
  let loaders = [{
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
      filename: "[name].[chunkhash].js",
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
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: path.join(__dirname, "..", "tsconfig.client.json"),
        },
      }),
      new HtmlWebpackPlugin({
        filename: path.join(__dirname, "..", "..", "build", "index.html"),
        template: path.join(__dirname, "index.ejs"),
        scriptLoading: "defer",
        inject: false,
      }),
      new HtmlWebpackTagsPlugin({
        tags: [
          {
            type: "css",
            path: "https://fonts.googleapis.com/css?family=Comfortaa",
            publicPath: false,
          },
          {
            type: "css",
            path: "https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&amp;display=swap",
            publicPath: false,
          },
          ...buildExternals(),
        ],
      }),
    ],
    optimization: {
      splitChunks: {
        chunks: "all",
      },
    },
  };
};
