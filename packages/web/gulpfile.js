/* eslint-disable global-require */
/* eslint-disable no-console */
const path = require("path");
const { promises: fs } = require("fs");

const webpack = require("webpack");
const sass = require("sass-embedded");
const { parallel, series, src, dest, watch } = require("gulp");

const TARGET = path.join(__dirname, "..", "..", "target", "web");

const STATICS = [
  path.join(__dirname, "static", "**", "*"),
  path.join(__dirname, "templates", "includes", "*"),
  path.join(__dirname, "templates", "*.html"),
];

async function clean() {
  await fs.rm(TARGET, { recursive: true, force: true });
}
exports.clean = clean;

async function buildCss() {
  await fs.mkdir(path.join(TARGET, "static", "css"), { recursive: true });

  for (let target of ["main", "bootstrap"]) {
    let { css } = sass.compile(path.join(__dirname, "css", `${target}.scss`), {
      loadPaths: [path.join(__dirname, "..", "..", "node_modules")],
      sourceMap: true,
    });

    await fs.writeFile(
      path.join(TARGET, "static", "css", `${target}.css`),
      css,
      {
        encoding: "utf8",
      },
    );
  }
}
exports.buildCss = buildCss;

function watchCss() {
  watch([path.join(__dirname, "css", "**", "*")], buildCss);
}
exports.watchCss = series(buildCss, watchCss);

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
  return src(STATICS, { base: __dirname }).pipe(dest(TARGET));
}
exports.buildStatic = buildStatic;

function watchStatic() {
  watch(STATICS, exports.buildStatic);
}
exports.watchStatic = series(exports.buildStatic, watchStatic);

exports.build = parallel(buildJs, buildCss, buildStatic);
exports.watch = parallel(watchJs, exports.watchCss, exports.watchStatic);

exports.default = exports.build;
