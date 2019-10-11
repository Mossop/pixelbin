/* eslint-env node */

import { src, dest, parallel, watch as filewatch } from "gulp";
import { RuleSetQuery } from "webpack";
import { Configuration } from "webpack";
import webpack = require("webpack-stream");
import named = require("vinyl-named");
import eslint = require("gulp-eslint");
import sass = require("gulp-sass");

import { config, path } from "./base/config";

function babelOptions(): RuleSetQuery {
  return {
    plugins: ["@babel/plugin-proposal-class-properties"],
    presets: [
      ["@babel/preset-typescript", {
        isTSX: true,
        allExtensions: true,
      }],
      ["@babel/preset-react"],
      ["@babel/preset-env", {
        targets: {
          browsers: ">3%"
        }
      }]
    ],
  };
}

function buildJsConfig(): Configuration {
  return {
    mode: config.general.debug ? "development" : "production",
    resolve: {
      extensions: [".wasm", ".mjs", ".js", ".json", ".ts", ".tsx"]
    },
    output: {
      publicPath: `${config.url.static}app/js/`,
      filename: "[name].js",
      chunkFilename: "[name].js",
    },
    devtool: "source-map",
    module: {
      rules: [{
        test: /\.(ts|js)x?$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "babel-loader",
          options: babelOptions(),
        }
      }],
    },
    externals: {
      "react": "React",
      "react-dom": "ReactDOM",
    },
  };
}

function watchJsConfig(): Configuration {
  let config = buildJsConfig();
  config.watch = true;
  return config;
}

export function lint(): NodeJS.ReadWriteStream {
  return src(["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
}

export function watchJs(): NodeJS.ReadWriteStream {
  return src([path("app", "js", "app.tsx")])
    .pipe(named())
    .pipe(webpack(watchJsConfig()))
    .pipe(dest(path(config.path.static, "app", "js")));
}

export function buildJs(): NodeJS.ReadWriteStream {
  return src([path("app", "js", "app.tsx")])
    .pipe(named())
    .pipe(webpack(buildJsConfig()))
    .pipe(dest(path(config.path.static, "app", "js")));
}

export function watchCss(): void {
  filewatch("**/*.scss", { cwd: path("app", "css") }, buildCss);
}

export function buildCss(): NodeJS.ReadWriteStream {
  return src([path("app", "css", "app.scss")])
    .pipe(sass().on('error', sass.logError))
    .pipe(dest(path(config.path.static, "app", "css")));
}

export const build = parallel(buildJs, buildCss);
export const watch = parallel(watchJs, watchCss);

export default build;
