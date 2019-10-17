/* eslint-env node */
import { src, dest, parallel } from "gulp";
import { RuleSetQuery } from "webpack";
import { Configuration } from "webpack";
import gulpWebpack from "webpack-stream";
import named from "vinyl-named";
import gulpEslint from "gulp-eslint";
import gulpSass from "gulp-sass";
import gulpTypeScript from "gulp-typescript";
import gulpWatch from "gulp-watch";
import through from "through2";
import { TransformCallback } from "stream";

import { config, path } from "./base/config";
import { BufferFile } from "vinyl";

const IGNORES = [
  "!node_modules/**/*",
  "!venv/**/*",
  "!public/**/*",
];

function allScripts(): string[] {
  return [
    "**/*.js",
    "**/*.jsx",
    "**/*.ts",
    "**/*.tsx",
    ...IGNORES
  ];
}

const tsProject = gulpTypeScript.createProject(path("tsconfig.json"));

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

export function eslint(): NodeJS.ReadWriteStream {
  return src(allScripts())
    .pipe(gulpEslint())
    .pipe(gulpEslint.formatEach());
}

export function watchEslint(): void {
  gulpWatch(allScripts())
    .pipe(through.obj(function (chunk: BufferFile, _: string, callback: TransformCallback): void {
      console.log(`Linting ${chunk.path}...`);
      this.push(chunk);
      callback();
    }))
    .pipe(gulpEslint())
    .pipe(gulpEslint.formatEach())
    .pipe(through.obj(function (chunk: BufferFile, _: string, callback: TransformCallback): void {
      console.log(`Finished linting ${chunk.path}...`);
      this.push(chunk);
      callback();
    }));
}

export function typescript(): NodeJS.ReadWriteStream {
  return src(allScripts())
    .pipe(tsProject());
}

export function watchBuildJs(): NodeJS.ReadWriteStream {
  return src([path("app", "js", "app.tsx")])
    .pipe(named())
    .pipe(gulpWebpack(watchJsConfig()))
    .pipe(dest(path(config.path.static, "app", "js")));
}

export function buildJs(): NodeJS.ReadWriteStream {
  return src([path("app", "js", "app.tsx")])
    .pipe(named())
    .pipe(gulpWebpack(buildJsConfig()))
    .pipe(dest(path(config.path.static, "app", "js")));
}

export function buildCss(): NodeJS.ReadWriteStream {
  return src([path("app", "css", "app.scss")])
    .pipe(gulpSass().on("error", gulpSass.logError))
    .pipe(dest(path(config.path.static, "app", "css")));
}

export function watchBuildCss(): void {
  gulpWatch(["**/*.scss",...IGNORES])
    .pipe(gulpSass().on("error", gulpSass.logError))
    .pipe(dest(path(config.path.static, "app", "css")));
}

export const lint = parallel(eslint, typescript);
export const watchLint = parallel(watchEslint);
export const build = parallel(buildJs, buildCss);
export const watchBuild = parallel(watchBuildJs, watchBuildCss);

export default build;
