const path = require("path");

const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackTagsPlugin = require("html-webpack-tags-plugin");
const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");

const TARGET = path.join(__dirname, "..", "..", "target", "web");

/**
 * @typedef { import("webpack").Configuration } Configuration
 */

/** @type {({mode?: "development" | "production"}) => Configuration} */
module.exports = ({ mode = "development" }) => {
  let splitChunks =
    mode == "production"
      ? {
          chunks: "all",
        }
      : {
          chunks: "all",
          maxInitialRequests: Infinity,
          minSize: 0,
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name(module) {
                // get the name. E.g. node_modules/packageName/not/this/part.js
                // or node_modules/packageName
                const packageName = module.context.match(
                  /[\\/]node_modules[\\/](.*?)([\\/]|$)/,
                )[1];

                // npm package names are URL-safe, but some servers don't like @ symbols
                return `npm.${packageName.replace("@", "")}`;
              },
            },
          },
        };

  return {
    mode,
    entry: {
      index: path.join(__dirname, "src", "index.js"),
    },
    resolve: {
      extensions: [".js"],
    },
    output: {
      path: path.join(TARGET, "static", "js"),
      publicPath: "/static/js/",
      filename: "[name].[chunkhash].js",
      crossOriginLoading: "anonymous",
    },
    stats: "errors-warnings",
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(js|ts|tsx)$/i,
          exclude: /node_modules/,
          loader: "babel-loader",
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: path.join(TARGET, "templates", "index.hbs"),
        template: path.join(__dirname, "templates", "index.hbs"),
        scriptLoading: "defer",
        inject: true,
        minify: false,
        chunks: ["index"],
      }),
      new SubresourceIntegrityPlugin({
        hashFuncNames: ["sha256", "sha384"],
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
        ],
      }),
    ],
    optimization: {
      usedExports: true,
      mangleExports: false,
      minimize: mode == "production",
      splitChunks,
      chunkIds: "named",
    },
  };
};
