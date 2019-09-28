/* eslint-env node */
const path = require("path");

const JS_ROOT = path.resolve(__dirname, "js");
const STATIC_ROOT = path.join(path.dirname(path.resolve(__dirname)), "public", "static", path.basename(__dirname));

module.exports = {
  mode: "development",
  entry: {
    app: path.join(JS_ROOT, "app.js"),
  },
  output: {
    path: path.join(STATIC_ROOT, "js"),
    publicPath: `/static/${path.basename(__dirname)}/js/`,
    filename: "[name].js",
    chunkFilename: "[name].js",
  },
  devtool: "source-map",
  module: {
    rules: [{
      test: /\.jsx?$/,
      use: "babel-loader",
    }],
  },
};
