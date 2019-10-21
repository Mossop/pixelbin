/* eslint-env node */
import { spawn } from "child_process";

import { src, dest, parallel, watch, series } from "gulp";
import { RuleSetQuery } from "webpack";
import { Configuration } from "webpack";
import gulpWebpack from "webpack-stream";
import named from "vinyl-named";
import gulpEslint from "gulp-eslint";
import gulpSass from "gulp-sass";
import gulpTypeScript from "gulp-typescript";

import { config, path } from "./base/config";

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

function exec(command: string, args: string[] = []): Promise<void> {
  return new Promise((resolve: () => void, reject: (err: Error) => void) => {
    let process = spawn(command, args, {
      stdio: "inherit",
      shell: true,
    });

    process.on("exit", (code: number) => {
      if (code !== 0) {
        reject(new Error(`Process exitied with code ${code}`));
      } else {
        resolve();
      }
    });

    process.on("error", (err: Error) => {
      reject(err);
    });
  });
}

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

export async function pylint(): Promise<void> {
  return exec("pylint", [`--rcfile=${path(".pylintrc")}`, "api", "app", "base", "config"]);
}

export function eslint(): NodeJS.ReadWriteStream {
  return src(allScripts())
    .pipe(gulpEslint())
    .pipe(gulpEslint.formatEach());
}

export function watchEslint(): void {
  watch(allScripts(), eslint);
}

export function typescript(): NodeJS.ReadWriteStream {
  return src(allScripts())
    .pipe(tsProject());
}

export function watchTypescript(): void {
  watch(allScripts(), typescript);
}

export async function staticContent(): Promise<void> {
  return exec(path("manage.py"), ["collectstatic", "--noinput"]);
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
  watch(["**/*.scss",...IGNORES], buildCss);
}

export const lint = series(eslint, typescript, pylint);
export const watchLint = parallel(watchEslint);
export const build = parallel(buildJs, buildCss, staticContent);
export const watchBuild = parallel(watchBuildJs, watchBuildCss, watchStaticContent);

export default build;
