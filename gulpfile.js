const { promises: fs } = require("fs");
const path = require("path");

const gulp = require("gulp");
const webpack = require("webpack");

const { mergeCoverage, reportCoverage } = require("./ci/coverage");
// eslint-disable-next-line @typescript-eslint/naming-convention
const { checkSpawn, Process } = require("./ci/process");
const { findBin } = require("./ci/utils");

/**
 * @typedef { import("webpack").Stats } Stats
 */

async function buildCoverage() {
  return mergeCoverage([
    path.join(__dirname, "coverage", "server", "coverage-final.json"),
    path.join(__dirname, "coverage", "client", "coverage-jest.json"),
    path.join(__dirname, "coverage", "client", "coverage-karma.json"),
  ], path.join(__dirname, "coverage", "coverage-final.json"));
}

async function showCoverage() {
  return reportCoverage(
    path.join(__dirname, "coverage", "coverage-final.json"),
    "text",
  );
}

exports.showCoverage = showCoverage;

function buildClientStatic() {
  return gulp.src(path.join(__dirname, "static", "client", "**", "*"))
    .pipe(gulp.dest(path.join(__dirname, "build", "static")));
}

const watchClientStatic = gulp.series(buildClientStatic, () => {
  gulp.watch(path.join(__dirname, "static", "client", "**", "*"), buildClientStatic);
});

/**
 * @return {Promise<void>}
 */
async function buildClientJs() {
  let webpackConfig = require("./src/client/webpack.config")("production");
  let compiler = webpack(webpackConfig);

  /**
   * @type {import("webpack").Stats}
   */
  let stats = await new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (err) {
        reject(err);
        return;
      }

      resolve(stats);
    });
  });

  let json = stats.toJson({
    moduleTrace: true,
    modules: true,
    entrypoints: true,
    chunkModules: true,
    chunks: true,
    chunkGroups: true,
    chunkOrigins: true,
  }, false);
  await fs.writeFile(path.join(__dirname, "build", "client", "stats.json"), JSON.stringify(json));

  console.log(stats.toString(webpackConfig.stats));

  if (stats.hasErrors()) {
    throw new Error("Compilation failed.");
  }
}

/**
 * @return {void}
 */
function watchClientJs() {
  let webpackConfig = require("./src/client/webpack.config")("development");
  let compiler = webpack(webpackConfig);

  compiler.watch({}, (err, stats) => {
    let results = stats.toString(webpackConfig.stats);
    if (results) {
      console.log(results);
    } else {
      console.log("Client code rebuilt.");
    }
  });
}

exports.buildClient = gulp.parallel(buildClientStatic, buildClientJs);

async function clientJest() {
  let jest = await findBin(__dirname, "jest");

  await checkSpawn(jest, [
    "--config",
    path.join(__dirname, "src", "client", "jest.config.js"),
    "--collectCoverage",
    "--ci",
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
    path.join(__dirname, "src", "tsconfig.server.json"),
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
    "--collectCoverage",
    "--ci",
  ]);
}

exports.testServer = gulp.series(serverJest, buildCoverage);

exports.build = gulp.series(exports.buildServer, exports.buildClient);
exports.test = gulp.series(serverJest, clientJest, clientKarma, buildCoverage);

async function lintPackages() {
  let packageLock = JSON.parse(await fs.readFile(path.join(__dirname, "package-lock.json"), {
    encoding: "utf8",
  }));

  let packagePath = path.join(__dirname, "src", "server", "webserver", "packages.json");
  let packages = JSON.parse(await fs.readFile(packagePath, {
    encoding: "utf8",
  }));

  let errors = [];

  for (let pkg of packages) {
    if (!(pkg.id in packageLock.dependencies)) {
      errors.push(`Package ${pkg.id} not listed in package-lock.json`);
      continue;
    }

    let lockInfo = packageLock.dependencies[pkg.id];

    if (pkg.version != lockInfo.version) {
      errors.push(`Webserver includes ${pkg.id} as version ${pkg.version} ` +
        `but ${lockInfo.version} was expected`);
      continue;
    }

    let file = pkg.path.split("/");
    let target = path.join(__dirname, "node_modules", pkg.id, ...file);
    try {
      let stat = await fs.stat(target);
      if (!stat.isFile()) {
        errors.push(`Target path for ${pkg.id} does not exist in package.`);
        continue;
      }
    } catch (e) {
      errors.push(`Target path for ${pkg.id} (${target}) does not exist in package.`);
      continue;
    }
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}

async function eslint() {
  let eslint = await findBin(__dirname, "eslint");

  await checkSpawn(eslint, [
    "--ext",
    ".ts,.js,.tsx,.jsx",
    __dirname,
  ]);
}

exports.lint = gulp.series(lintPackages, exports.buildServer, buildClientJs, eslint);

exports.run = gulp.parallel(watchClientJs, watchClientStatic, async function() {
  let server = new Process("node", [
    path.join(__dirname, "build", "server"),
    path.join(__dirname, "testconfig.json"),
  ]);
  let pretty = new Process(await findBin(__dirname, "pino-pretty"));
  server.pipe(pretty);

  let code = await server.exitCode;
  if (code != 0) {
    throw new Error(`Server exited with exit code ${code}`);
  }
});

exports.migrate = gulp.series(exports.build, async function migrate() {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { DatabaseConnection } = require("./build/server/database");

  let connection = await DatabaseConnection.connect({
    username: "pixelbin",
    password: "pixelbin",
    host: "localhost",
    port: 5432,
    database: "pixelbin",
  });

  await connection.knex.migrate.latest();

  await connection.createUser({
    email: "dtownsend@oxymoronical.com",
    fullname: "Dave Townsend",
    password: "testpassword",
  });

  await connection.destroy();
});

exports.clean = async function() {
  let buildDir = path.join(__dirname, "build");
  await fs.rmdir(buildDir, {
    recursive: true,
  });
};
