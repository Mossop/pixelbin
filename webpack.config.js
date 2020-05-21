const { config, path } = require("./base/config");

/**
 * @typedef { import("webpack").Configuration } Configuration
 */

/** @type {Configuration} */
module.exports = {
  mode: config.general.debug ? "development" : "production",
  entry: path("app", "js", "bootstrap.tsx"),
  resolve: {
    extensions: [".js", ".ts", ".tsx"],
  },
  output: {
    path: path(config.path.build, "app", "js"),
    publicPath: `${config.url.static}app/js/`,
    filename: "app.js",
    chunkFilename: "[name].js",
  },
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
  externals: {
    "react": "React",
    "react-dom": "ReactDOM",
  },
};
