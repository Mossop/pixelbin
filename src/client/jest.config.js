const path = require("path");

module.exports = {
  preset: "ts-jest",
  testRegex: [
    "\\.test\\.[jt]sx?$",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
  ],
  setupFilesAfterEnv: [
    "jest-mock-console/dist/setupTestFramework.js",
  ],
  resetModules: true,
  clearMocks: true,
  testTimeout: 10000,

  testEnvironment: "jest-environment-jsdom-global",
  testEnvironmentOptions: {
    url: "http://pixelbin/",
  },
  collectCoverageFrom: [
    "**/*.ts",
    "**/*.tsx",
  ],
  coveragePathIgnorePatterns: [
    "<rootDir>/.*\\.test\\.ts$",
    "<rootDir>/.*\\.karma\\.ts$",
    "/test-helpers",
  ],
  coverageDirectory: path.join(__dirname, "..", "..", "coverage", "client"),
  coverageReporters: [["json", {
    file: "coverage-jest.json",
  }]],
  globals: {
    "ts-jest": {
      tsConfig: path.join(__dirname, "..", "..", "tsconfig.json"),
    },
  },
};
