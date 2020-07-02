const { promises: fs } = require("fs");
const path = require("path");

const gulp = require("gulp");
const sass = require("node-sass");
const webpack = require("webpack");

const { mergeCoverage, reportCoverage } = require("./ci/coverage");
const { checkSpawn, Process } = require("./ci/process");
const { findBin, ensureDir } = require("./ci/utils");

/**
 * @typedef { import("webpack").Stats } Stats
 * @typedef { import("node-sass").Options } SassOptions
 * @typedef { import("node-sass").Result } SassResult
 */

async function buildCoverage() {
  return mergeCoverage([
    path.join(__dirname, "coverage", "coverage-jest.json"),
    path.join(__dirname, "src", "client", "coverage", "coverage-jest.json"),
    path.join(__dirname, "src", "client", "coverage", "coverage-karma.json"),
  ], path.join(__dirname, "coverage", "coverage-final.json"));
}

async function showCoverage() {
  return reportCoverage(
    path.join(__dirname, "coverage", "coverage-final.json"),
    "text",
  );
}

exports.showCoverage = showCoverage;

/**
 * @param {SassOptions} options
 * @return {Promise<SassResult>}
 */
function cssRender(options) {
  return new Promise((resolve, reject) => {
    sass.render(options, (err, result) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (err) {
        reject(err.message);
      } else {
        resolve(result);
      }
    });
  });
}

function buildClientStatic() {
  return gulp.src(path.join(__dirname, "src", "client", "static", "**", "*"))
    .pipe(gulp.dest(path.join(__dirname, "build", "client", "static")));
}

/**
 * @return {Promise<void>}
 */
function buildClientJs() {
  const webpackConfig = require("./src/client/webpack.config");
  let compiler = webpack(webpackConfig);

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (err) {
        reject(err);
        return;
      }

      console.log(stats.toString(webpackConfig.stats));

      if (stats.hasErrors()) {
        reject(new Error("Compilation failed."));
        return;
      }

      resolve();
    });
  });
}

/**
 * @return {Promise<void>}
 */
async function buildClientCss() {
  let fileTarget = path.join(__dirname, "build", "client", "css", "app.css");
  let mapTarget = path.join(__dirname, "build", "client", "css", "app.css.map");

  await ensureDir(fileTarget);

  let result = await cssRender({
    file: path.join(__dirname, "src", "client", "css", "app.scss"),
    outFile: fileTarget,
    sourceMap: mapTarget,
  });

  await Promise.all([
    fs.writeFile(fileTarget, result.css),
    fs.writeFile(mapTarget, result.map),
  ]);
}

exports.buildClient = gulp.parallel(buildClientStatic, buildClientCss, buildClientJs);

async function clientJest() {
  let jest = await findBin(__dirname, "jest");

  await checkSpawn(jest, [
    "--config",
    path.join(__dirname, "src", "client", "jest.config.js"),
  ]);
}

async function clientKarma() {
  let karma = await findBin(__dirname, "karma");

  await checkSpawn(karma, [
    "start",
    path.join(__dirname, "src", "client", "karma.config.js"),
    "--single-run",
  ], {
    env: {
      ...process.env,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      NODE_ENV: "test",
    },
  });
}

exports.testClientJest = gulp.series(clientJest, buildCoverage);
exports.testClientKarma = gulp.series(clientKarma, buildCoverage);
exports.testClient = gulp.series(clientJest, clientKarma, buildCoverage);

exports.buildServer = async function buildServer() {
  let tsc = await findBin(__dirname, "tsc");

  await checkSpawn(tsc, [
    "--build",
    path.join(__dirname, "src", "server", "tsconfig.build.json"),
  ]);

  // Knex strenuously objects to declaration files in the migrations directory.
  // See https://github.com/knex/knex/issues/1922
  let migrations = path.join(__dirname, "build", "server", "database", "migrations");
  let files = await fs.readdir(migrations);
  for (let file of files) {
    if (file.endsWith(".ts") || file.endsWith(".ts.map")) {
      await fs.unlink(path.join(migrations, file));
    }
  }
};

async function serverJest() {
  let jest = await findBin(__dirname, "jest");

  await checkSpawn(jest, [
    "--config",
    path.join(__dirname, "jest.config.js"),
  ]);
}

exports.testServer = gulp.series(serverJest, buildCoverage);

exports.build = gulp.parallel(exports.buildClient, exports.buildServer);
exports.test = gulp.series(serverJest, clientJest, clientKarma, buildCoverage);

exports.lint = gulp.series(exports.build, async function() {
  let eslint = await findBin(__dirname, "eslint");

  await checkSpawn(eslint, [
    "--ext",
    ".ts,.js,.tsx,.jsx",
    __dirname,
  ]);
});

exports.run = async function() {
  let server = new Process("node", [path.join(__dirname, "build", "server")]);
  let pretty = new Process(await findBin(__dirname, "pino-pretty"));
  server.pipe(pretty);

  let code = await server.exitCode;
  if (code != 0) {
    throw new Error(`Server exited with exit code ${code}`);
  }
};
