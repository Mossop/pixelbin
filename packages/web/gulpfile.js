/* eslint-disable global-require */
/* eslint-disable no-console */
const path = require("path");
const { promises: fs } = require("fs");

const webpack = require("webpack");
const { parallel, series, src, dest, watch } = require("gulp");

const TARGET = path.join(__dirname, "..", "..", "target", "web");

async function clean() {
  await fs.rm(TARGET, { recursive: true, force: true });
}
exports.clean = clean;

function buildJs() {
  let config = require("./webpack.config.js")({ mode: "development" });
  let compiler = webpack(config);

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
        return;
      }

      console.log(
        stats.toString({
          chunks: false,
          colors: true,
        }),
      );

      resolve();
    });
  });
}
exports.buildJs = buildJs;

function watchJs() {
  let config = require("./webpack.config.js")({ mode: "development" });
  let compiler = webpack(config);

  return new Promise((_resolve, reject) => {
    let watching = compiler.watch({}, (err, stats) => {
      if (err) {
        watching.close(() => {
          reject(err);
        });
        return;
      }

      console.log(
        stats.toString({
          chunks: false,
          colors: true,
        }),
      );
    });
  });
}
exports.watchJs = watchJs;

function buildStatic() {
  return src(path.join(__dirname, "static", "**", "*")).pipe(
    dest(path.join(TARGET, "static")),
  );
}
exports.buildStatic = buildStatic;

function watchStatic() {
  watch([path.join(__dirname, "static", "**", "*")], buildStatic);
}
exports.watchStatic = series(buildStatic, watchStatic);

exports.build = parallel(buildJs, buildStatic);
exports.watch = parallel(watchJs, exports.watchStatic);

exports.default = exports.build;
