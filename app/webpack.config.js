/* eslint-env node */
const path = require("path");

const JS_ROOT = path.resolve(__dirname, "js");
const STATIC_ROOT = path.resolve(__dirname, "static", path.basename(__dirname));

module.exports = {
  mode: "development",
  entry: path.join(JS_ROOT, "app.js"),
  output: {
    path: path.join(STATIC_ROOT, "js"),
    filename: "app.js",
  },
  devtool: "source-map",
  module: {
    rules: [{
      test: /\.jsx?$/,
      use: "babel-loader",
    }],
  },
};
