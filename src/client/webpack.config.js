const path = require("path");

const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackTagsPlugin = require("html-webpack-tags-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const SriPlugin = require("webpack-subresource-integrity");

/**
 * @typedef {Object} External
 * @property {string} id
 * @property {string} variable
 * @property {string} developmentPath
 * @property {string} productionPath
 */

// eslint-disable-next-line import/no-restricted-paths
const lock = require("../../package-lock.json");
/**
 * @type {External[]}
 */
const externals = require("./externals.json");

/**
 * @typedef { import("webpack").Configuration } Configuration
 */

/**
 * @param {"development" | "production" | "test"} mode
 * @returns {HtmlWebpackTagsPlugin.MaybeScriptTagOptions[]}
 */
function buildExternals(mode) {
  return externals.map(pkg => {
    let path = mode == "production" ? pkg.productionPath : pkg.developmentPath;
    return {
      type: "js",
      path: `https://unpkg.com/${pkg.id}@${lock.dependencies[pkg.id].version}/${path}`,
      publicPath: false,
      attributes: {
        crossorigin: true,
        nonce: "{% nonce %}",
      },
      external: {
        packageName: pkg.id,
        variableName: pkg.variable,
      },
    };
  });
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
      path: path.join(__dirname, "..", "..", "dist", "client"),
      publicPath: "/app/",
      filename: "[name].[chunkhash].js",
      crossOriginLoading: "anonymous",
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
      // eslint-disable-next-line @typescript-eslint/naming-convention
      perf_hooks: "null",
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        typescript: {
          configFile: path.join(__dirname, "..", "tsconfig.client.json"),
        },
      }),
      new HtmlWebpackPlugin({
        filename: path.join(__dirname, "..", "..", "dist", "index.html"),
        template: path.join(__dirname, "index.ejs"),
        scriptLoading: "defer",
        inject: true,
        minify: false,
      }),
      new SriPlugin({
        hashFuncNames: ["sha256", "sha384"],
      }),
      new HtmlWebpackTagsPlugin({
        tags: [
          {
            type: "css",
            path: "https://fonts.googleapis.com/css?family=Comfortaa",
            publicPath: false,
            attributes: {
              nonce: "{% nonce %}",
            },
          },
          {
            type: "css",
            path: "https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&amp;display=swap",
            publicPath: false,
            attributes: {
              nonce: "{% nonce %}",
            },
          },
          {
            type: "css",
            path: "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css",
            publicPath: false,
            attributes: {
              nonce: "{% nonce %}",
              integrity:
  "sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==",
            },
          },
          ...buildExternals(mode),
        ],
      }),
    ],
    optimization: {
      usedExports: true,
      minimize: mode == "production",
      minimizer: [new TerserPlugin()],
      splitChunks: {
        chunks: "all",
      },
    },
  };
};
