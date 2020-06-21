const path = require("path");

const { spawn } = require("./process");
const { findBin } = require("./utils");

/**
 * @return {import("./types").JestConfig}
 */
exports.jestConfig = function() {
  return {
    preset: "ts-jest",
    testEnvironment: "node",
    testRegex: [
      "\\.test\\.[jt]sx?$",
    ],
    testPathIgnorePatterns: [
      "/build/",
      "/node_modules/",
    ],
    collectCoverageFrom: [
      "src/**/*.ts",
    ],
    coveragePathIgnorePatterns: [
      "<rootDir>/.*\\.test\\.ts$",
    ],
    coverageDirectory: "coverage",
    coverageReporters: [["json", {
      file: "coverage-final.json",
    }]],
    resetModules: true,
    clearMocks: true,
  };
};

/**
 * @param {string} root
 * @param {string} config
 * @return {() => Promise<void>}
 */
exports.jest = (root, config = path.join(root, "jest.config.js")) => {
  return async function() {
    let jestBin = await findBin(root, "jest");

    let exitCode = await spawn(jestBin, [
      "--config",
      config,
      "--coverage",
    ], {
      cwd: root,
      shell: true,
      env: {
        ...process.env,

        // eslint-disable-next-line @typescript-eslint/naming-convention
        NODE_ENV: "test",
      },
    });

    if (exitCode != 0) {
      throw new Error(`Jest exited with exit code ${exitCode}`);
    }
  };
};

