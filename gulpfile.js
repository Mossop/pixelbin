const fs = require("fs").promises;
const path = require("path");

const asyncDone = require("async-done");
const log = require("gulplog");
const { ansi, tsLint, eslint, logLints, joined, mergeCoverage } = require("pixelbin-ci");
const prettyTime = require("pretty-hrtime");

/**
 * @typedef {Object} Package
 * @property {string} path
 * @property {string} name
 * @property {string[]} dependencies
 */

/**
 * Loads the graph of packages.
 *
 * @param {string} root
 * @return {Promise<Record<string, Package>>}
 */
async function loadGraph(root) {
  /** @type {Record<string, Package>} */
  let packages = {};
  let packageInfos = {};
  let packageDirs = await fs.readdir(path.join(root));

  for (let dir of packageDirs) {
    try {
      let stats = await fs.stat(path.join(root, dir));
      if (!stats.isDirectory()) {
        continue;
      }
    } catch (e) {
      continue;
    }

    let packageInfo = require(path.join(root, dir, "package.json"));
    packages[packageInfo.name] = {
      path: path.join(root, dir),
      name: packageInfo.name,
      dependencies: [],
    };
    packageInfos[packageInfo.name] = packageInfo;
  }

  for (let package of Object.keys(packages)) {
    let deps = packageInfos[package].dependencies ?? {};
    let devDeps = packageInfos[package].devDependencies ?? {};
    for (let key of Object.keys(packages)) {
      if (key == package) {
        continue;
      }

      if (key in deps || key in devDeps) {
        packages[package].dependencies.push(key);
      }
    }
  }

  return packages;
}

const packageGraph = loadGraph(path.join(__dirname, "packages"));

/**
 * Runs an action for a package first running the action for all of its
 * dependency tree. Actions will be parallelized where possible.
 *
 * @param {string} root
 * @param {string} package
 * @param {(package: Package) => Promise<void>} doAction
 * @return {Promise<void>}
 */
async function applyToPackage(root, package, doAction) {
  let graph = await packageGraph;

  /** @type {Map<string, Promise<void>>} */
  let actionCache = new Map();

  /**
   * @param {string} id
   * @return {Promise<void>}
   */
  function getAction(id) {
    let pending = actionCache.get(id);
    if (pending) {
      return pending;
    }

    let package = graph[id];

    // Run the action for all dependencies first.
    let deps = package.dependencies.map(d => getAction(d));

    let action = Promise.all(deps).then(() => {
      return doAction(graph[id]);
    });

    actionCache.set(id, action);
    return action;
  }

  return getAction(package);
}

/**
 * Runs an action for all packages first running the action for all of their
 * dependency tree. Actions will be parallelized where possible.
 *
 * @param {string} root
 * @param {(package: Package) => Promise<void>} doAction
 * @return {Promise<void>}
 */
async function applyToAllPackages(root, doAction) {
  let graph = await packageGraph;

  /** @type {Map<string, Promise<void>>} */
  let actionCache = new Map();

  /**
   * @param {string} id
   * @return {Promise<void>}
   */
  function getAction(id) {
    let pending = actionCache.get(id);
    if (pending) {
      return pending;
    }

    let package = graph[id];

    // Run the action for all dependencies first.
    let deps = package.dependencies.map(d => getAction(d));

    let action = Promise.all(deps).then(() => {
      return doAction(graph[id]);
    });

    actionCache.set(id, action);
    return action;
  }

  await Promise.all(Object.keys(graph).map(getAction));
}

/**
 * @param {Package} package
 * @param {string} task
 * @param {string} [verb]
 * @return {Promise<void>}
 */
async function runPackageTask(package, task, verb = task) {
  let id = package.name;
  log.info(`${verb} '${ansi.cyan(id)}'...`);
  let startTime = process.hrtime();

  try {
    let module = require(path.join(package.path, "gulpfile"));

    if (task in module) {
      await new Promise((resolve, reject) => {
        asyncDone(module[task], err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      log.info(
        `Nothing to do in '${ansi.cyan(id)}'`,
      );
    }

    let time = prettyTime(process.hrtime(startTime));
    log.info(
      `Finished ${verb.toLocaleLowerCase()} '${ansi.cyan(id)}' after ${ansi.magenta(time)}`,
    );
  } catch (e) {
    let time = prettyTime(process.hrtime(startTime));
    log.error(
      `${verb} '${ansi.cyan(id)}' ${ansi.red("errored after")} ${ansi.magenta(time)}`,
    );

    throw e;
  }
}

/**
 * @param {string} task
 * @param {string} verb
 * @return {Promise<void>}
 */
async function runInAllPackages(task, verb = task) {
  let graph = await packageGraph;
  for (let package of Object.values(graph)) {
    await runPackageTask(package, task, verb);
  }
}

exports.buildServer = async function() {
  return applyToPackage(path.join(__dirname, "packages"), "pixelbin-server", async package => {
    return runPackageTask(package, "build", "Building");
  });
};

exports.buildClient = async function() {
  return applyToPackage(path.join(__dirname, "packages"), "pixelbin-client", async package => {
    return runPackageTask(package, "build", "Building");
  });
};

exports.build = async function() {
  return applyToAllPackages(path.join(__dirname, "packages"), async package => {
    return runPackageTask(package, "build", "Building");
  });
};

exports.mergeCoverage = async function() {
  let graph = await loadGraph(path.join(__dirname, "packages"));
  return mergeCoverage(
    Object.values(graph).map(pkg => path.join(pkg.path, "coverage", "coverage-final.json")),
    path.join(__dirname, "coverage", "coverage-final.json"),
  );
};

exports.jest = async function() {
  let graph = await packageGraph;

  await runInAllPackages("jest", "Running jest");

  return mergeCoverage(
    Object.values(graph).map(pkg => path.join(pkg.path, "coverage", "coverage-final.json")),
    path.join(__dirname, "coverage", "coverage-final.json"),
  );
};

exports.karma = async function() {
  let graph = await packageGraph;

  await runInAllPackages("karma", "Running karma");

  return mergeCoverage(
    Object.values(graph).map(pkg => path.join(pkg.path, "coverage", "coverage-final.json")),
    path.join(__dirname, "coverage", "coverage-final.json"),
  );
};

exports.test = async function() {
  let graph = await packageGraph;

  await runInAllPackages("test", "Testing");

  return mergeCoverage(
    Object.values(graph).map(pkg => path.join(pkg.path, "coverage", "coverage-final.json")),
    path.join(__dirname, "coverage", "coverage-final.json"),
  );
};

exports.lint = async function() {
  let graph = await loadGraph(path.join(__dirname, "packages"));
  let tsLints = Object.values(graph).map(package => {
    return tsLint(package.path);
  });

  let succeeded = await logLints(joined(eslint(__dirname), tsLint(__dirname), ...tsLints));
  if (!succeeded) {
    throw new Error("Failed lint checks.");
  }
};
