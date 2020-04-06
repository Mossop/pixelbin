/* eslint-env node */
import { src, dest, parallel, watch } from "gulp";
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
      extensions: [".wasm", ".mjs", ".js", ".json", ".ts", ".tsx"],
    },
    output: {
      publicPath: `${config.url.static}app/js/`,
      filename: "[name].js",
      chunkFilename: "[name].js",
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.(ts|js)x?$/,
          exclude: /(node_modules|bower_components)/,
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

export async function staticContent(): Promise<void> {
  console.log(await exec(path("manage.py"), ["collectstatic", "--noinput"]));
}

export function watchStaticContent(): void {
  watch(["app/static/**/*"], staticContent);
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
  watch(["**/*.scss", ...IGNORES], buildCss);
}

export const build = parallel(buildJs, buildCss, staticContent);
export const watchBuild = parallel(watchBuildJs, watchBuildCss, watchStaticContent);

export default build;
