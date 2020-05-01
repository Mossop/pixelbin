/* eslint-env node */
import { src, dest, series, parallel, watch } from "gulp";
import gulpSass from "gulp-sass";
import mergeStreams from "merge-stream";
import named from "vinyl-named";
import { Configuration, RuleSetQuery } from "webpack";

import { config, path } from "./base/config";
import { eslintCheck } from "./ci/eslint";
import { pylintCheck } from "./ci/pylint";
import { typeScriptCheck } from "./ci/typescript";
import { exec, logLints } from "./ci/utils";

import gulpWebpack = require("webpack-stream");

const IGNORES = [
  "!base/**/*",
  "!node_modules/**/*",
  "!venv/**/*",
  "!public/**/*",
  "!api/migrations/**/*",
  "!coverage/**/*",
];

function allScripts(): string[] {
  return [
    "**/*.js",
    "**/*.jsx",
    "**/*.ts",
    "**/*.tsx",
    ...IGNORES,
  ];
}

function babelOptions(): RuleSetQuery {
  return {
    passPerPreset: true,
    plugins: [
      "@babel/plugin-proposal-class-properties",
      "@babel/plugin-proposal-optional-chaining",
      "@babel/plugin-proposal-nullish-coalescing-operator",
    ],
    presets: [
      [
        "@babel/preset-typescript", {
          isTSX: true,
          allExtensions: true,
        },
      ],
      ["@babel/preset-react"],
      [
        "@babel/preset-env", {
          targets: "defaults",
          useBuiltIns: "usage",
          corejs: 3,
        },
      ],
    ],
  };
}

function buildJsConfig(): Configuration {
  return {
    mode: config.general.debug ? "development" : "production",
    resolve: {
      extensions: [".js", ".ts", ".tsx"],
    },
    output: {
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
            options: babelOptions(),
          },
        },
      ],
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

function pylint(): NodeJS.ReadWriteStream {
  return src(["**/*.py", ...IGNORES])
    .pipe(pylintCheck([`--rcfile=${path(".pylintrc")}`]));
}

function eslint(): NodeJS.ReadWriteStream {
  return src(allScripts())
    .pipe(eslintCheck());
}

function typescript(): NodeJS.ReadWriteStream {
  return src([path("tsconfig.json"), ...allScripts()])
    .pipe(typeScriptCheck(path("tsconfig.json")));
}

export function lint(): NodeJS.ReadWriteStream {
  return mergeStreams(pylint(), eslint(), typescript())
    .pipe(logLints());
}

export function watchLint(): void {
  watch(["**/*.py", ...allScripts()], lint);
}

export function watchBuildJs(): NodeJS.ReadWriteStream {
  return src([path("app", "js", "bootstrap.tsx")])
    .pipe(named())
    .pipe(gulpWebpack(watchJsConfig()))
    .pipe(dest(path(config.path.build, "app", "js")));
}

export function buildJs(): NodeJS.ReadWriteStream {
  return src([path("app", "js", "bootstrap.tsx")])
    .pipe(named())
    .pipe(gulpWebpack(buildJsConfig()))
    .pipe(dest(path(config.path.build, "app", "js")));
}

export function buildCss(): NodeJS.ReadWriteStream {
  return src([path("app", "css", "app.scss")])
    .pipe(gulpSass().on("error", (error?: string | undefined): void => gulpSass.logError(error)))
    .pipe(dest(path(config.path.build, "app", "css")));
}

export function watchBuildCss(): void {
  watch(["**/*.scss", ...IGNORES], buildCss);
}

export const build = parallel(buildJs, buildCss);
export const watchBuild = series(buildCss, parallel(watchBuildJs, watchBuildCss));

export default build;
