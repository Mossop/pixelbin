const path = require("path");

const HtmlWebpackPlugin = require("html-webpack-plugin");
const { SubresourceIntegrityPlugin } = require("webpack-subresource-integrity");

const TARGET = path.join(__dirname, "..", "..", "target", "web");

/**
 * @typedef { import("webpack").Configuration } Configuration
 */

const ENTRIES = ["index", "album", "notfound"];

/** @type {({mode?: "development" | "production"}) => Configuration} */
module.exports = ({ mode = "development" }) =>
  // let splitChunks =
  //   mode == "production"
  //     ? {
  //         chunks: "all",
  //       }
  //     : {
  //         chunks: "all",
  //         maxInitialRequests: Infinity,
  //         minSize: 0,
  //         cacheGroups: {
  //           vendor: {
  //             test: /[\\/]node_modules[\\/]/,
  //             name(module) {
  //               // get the name. E.g. node_modules/packageName/not/this/part.js
  //               // or node_modules/packageName
  //               const packageName = module.context.match(
  //                 /[\\/]node_modules[\\/](.*?)([\\/]|$)/,
  //               )[1];

  //               // npm package names are URL-safe, but some servers don't like @ symbols
  //               return `npm.${packageName.replace("@", "")}`;
  //             },
  //           },
  //         },
  //       };

  ({
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
      filename: mode == "production" ? "[name].[chunkhash].js" : "[name].js",
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
        {
          test: /\.s[ac]ss$/i,
          use: [
            {
              loader: "css-loader",
              options: {
                sourceMap: false,
              },
            },
            {
              loader: "sass-loader",
              options: {
                sourceMap: false,
              },
            },
          ],
        },
      ],
    },
    plugins: [
      ...ENTRIES.map(
        (name) =>
          new HtmlWebpackPlugin({
            filename: path.join(TARGET, "templates", `${name}.hbs`),
            template: path.join(__dirname, "templates", `${name}.hbs`),
            scriptLoading: "defer",
            inject: true,
            minify: false,
            chunks: ["index"],
          }),
      ),
      new SubresourceIntegrityPlugin({
        hashFuncNames: ["sha256", "sha384"],
      }),
    ],
    optimization: {
      usedExports: true,
      mangleExports: false,
      minimize: mode == "production",
      // splitChunks,
      chunkIds: "named",
    },
  });
