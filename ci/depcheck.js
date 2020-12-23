const path = require("path");

const depcheck = require("depcheck");

const packages = require("../package.json");

const TYPES_PREFIX = "@types/";

const ADDITIONAL_DEPENDENCIES = [
  "redis",
  "pino-pretty",
];

const ADDITIONAL_DEV_DEPENDENCIES = [
  "@types/leaflet",
  "@types/node",
  "@types/resize-observer-browser",
  "@types/terser-webpack-plugin",
  "@typescript-eslint/eslint-plugin",
  "cache-loader",
  "cross-env",
  "css-mediaquery",
  "depcheck",
  "eslint",
  "eslint-import-resolver-ts",
  "eslint-plugin-import",
  "eslint-plugin-react",
  "jest",
  "jest-environment-jsdom-global",
  "jest-environment-jsdom-sixteen",
  "jsdom",
  "leaflet",
  "rimraf",
  "run-z",
  "ts-jest",
  "ts-loader",
  "typescript",
];

/**
 * @param {string} root
 * @param {string[]} sources
 * @returns {boolean}
 */
function isServerCode(root, sources) {
  for (let source of sources) {
    if (source.includes("test-helpers") || source.includes(".test.")) {
      continue;
    }

    let parts = path.relative(root, source).split(path.sep);

    if (parts.shift() != "src") {
      continue;
    }

    switch (parts.shift()) {
      case "model":
      case "server":
      case "utils":
      case "index.ts":
        return true;
    }
  }

  return false;
}

/**
 * @param {string} package
 * @returns {string}
 */
function typePackage(package) {
  if (package.startsWith("@")) {
    let split = package.indexOf("/");
    if (split > 1) {
      return `@types/${package.substring(1, split)}__${package.substring(split + 1)}`;
    }
  }

  return `@types/${package}`;
}

/**
 * @param {Set<string>} list
 * @param {string} message
 * @returns {number}
 */
function logIssues(list, message) {
  if (list.size) {
    console.log(message);
    let packages = [...list];
    packages.sort();
    for (let package of packages) {
      console.log(`    ${package}`);
    }
    console.log();
  }

  return list.size;
}

async function checkDependencies() {
  let root = path.resolve(path.dirname(__dirname));

  let results = await depcheck(root, {
    package: {
      dependencies: {},
      devDependencies: {},
    },
  });

  /**
   * @type {Set<string>}
   */
  let dependencies = new Set();
  /**
   * @type {Set<string>}
   */
  let types = new Set();
  /**
   * @type {Set<string>}
   */
  let unexpectedDependencies = new Set();
  /**
   * @type {Set<string>}
   */
  let unexpectedDevDependencies = new Set();
  /**
   * @type {Set<string>}
   */
  let missingDependencies = new Set();
  /**
   * @type {Set<string>}
   */
  let missingDevDependencies = new Set();
  /**
   * @type {Set<string>}
   */
  let devNotDep = new Set();
  /**
   * @type {Set<string>}
   */
  let depNotDev = new Set();

  for (let package of ADDITIONAL_DEPENDENCIES) {
    types.add(typePackage(package));
  }

  for (let package of ADDITIONAL_DEV_DEPENDENCIES) {
    types.add(typePackage(package));
  }

  for (let [package, sources] of Object.entries(results.using)) {
    if (package.startsWith(TYPES_PREFIX)) {
      continue;
    }

    dependencies.add(package);
    types.add(typePackage(package));

    if (isServerCode(root, sources)) {
      if (!(package in packages.dependencies)) {
        if (package in packages.devDependencies) {
          devNotDep.add(package);
        } else {
          missingDependencies.add(package);
        }
      }
    } else if (!(package in packages.devDependencies)) {
      if (package in packages.dependencies) {
        depNotDev.add(package);
      } else {
        missingDevDependencies.add(package);
      }
    }
  }

  for (let package of Object.keys(packages.dependencies)) {
    if (ADDITIONAL_DEPENDENCIES.includes(package)) {
      continue;
    }

    if (package.startsWith(TYPES_PREFIX)) {
      if (!types.has(package)) {
        unexpectedDependencies.add(package);
      } else {
        depNotDev.add(package);
      }
    } else if (!dependencies.has(package)) {
      unexpectedDependencies.add(package);
    }
  }

  for (let package of Object.keys(packages.devDependencies)) {
    if (ADDITIONAL_DEV_DEPENDENCIES.includes(package)) {
      continue;
    }

    if (package.startsWith(TYPES_PREFIX)) {
      if (!types.has(package)) {
        unexpectedDevDependencies.add(package);
      }
    } else if (!dependencies.has(package)) {
      unexpectedDevDependencies.add(package);
    }
  }

  let issues = 0;
  issues += logIssues(unexpectedDependencies, "Unexpected dependencies:");
  issues += logIssues(unexpectedDevDependencies, "Unexpected devDependencies:");
  issues += logIssues(missingDependencies, "Missing dependencies:");
  issues += logIssues(missingDevDependencies, "Missing devDependencies:");
  issues += logIssues(devNotDep, "Expected to be dependencies but are devDependencies:");
  issues += logIssues(depNotDev, "Expected to be devDependencies but are dependencies:");

  if (issues == 0) {
    console.log("Dependency check found no issues.");
  } else {
    console.log(`Dependency check found ${issues} issues.`);
    process.exit(1);
  }
}

checkDependencies().catch(e => {
  console.error(e);
  process.exit(1);
});
