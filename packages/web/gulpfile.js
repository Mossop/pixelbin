/* eslint-disable global-require */
/* eslint-disable no-console */
const path = require("path");
const { promises: fs } = require("fs");

const webpack = require("webpack");
const sass = require("sass-embedded");
const { parallel, src, dest } = require("gulp");

const TARGET = path.join(__dirname, "..", "..", "target", "web");

function promiseWebpack(config) {
  return new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
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

async function clean() {
  await fs.rm(TARGET, { recursive: true, force: true });
}
exports.clean = clean;

async function buildJs() {
  let config = require("./webpack.config.js")({ mode: "development" });

  await promiseWebpack(config);
}
exports.buildJs = buildJs;

async function buildCss() {
  let { css } = await sass.compileAsync(
    path.join(__dirname, "css", "main.scss"),
  );
  await fs.mkdir(path.join(TARGET, "static", "css"), { recursive: true });
  await fs.writeFile(path.join(TARGET, "static", "css", "main.css"), css, {
    encoding: "utf8",
  });
}
exports.buildCss = buildCss;

function buildStatic() {
  return src(path.join(__dirname, "static", "**", "*")).pipe(
    dest(path.join(TARGET, "static")),
  );
}
exports.buildStatic = buildStatic;

exports.build = parallel(buildJs, buildStatic, buildCss);
