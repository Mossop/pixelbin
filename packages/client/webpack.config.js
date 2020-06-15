const path = require("path");

const ENV = process.env.NODE_ENV ?? "development";

/**
 * @typedef { import("webpack").Configuration } Configuration
 */

/** @type {Configuration} */
module.exports = {
  mode: ENV == "test" ? "development" : ENV,
  entry: path.join(__dirname, "src", "bootstrap.tsx"),
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
  output: {
    path: path.join(__dirname, "build", "js"),
    publicPath: "/app/js/",
    filename: "app.js",
    chunkFilename: "[name].js",
  },
  devtool: ENV == "test" ? "inline-source-map" : "source-map",
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules|\.karma\.[jt]sx?$|\.test\.[jt]sx?$/,
        use: {
          loader: "babel-loader",
          options: {
            plugins: ENV == "test" ? ["istanbul"] : [],
            cacheDirectory: true,
          },
        },
      }, {
        test: /\.karma\.[jt]sx?/,
        exclude: /node_modules/,
        use: [{
          loader: "babel-loader",
          options: {
            cacheDirectory: true,
          },
        }],
      },
    ],
  },
  externals: {
    "react": "React",
    "react-dom": "ReactDOM",
  },
};
