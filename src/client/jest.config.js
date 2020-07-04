const jestConfig = require("../../jest.config");

module.exports = {
  ...jestConfig,
  testEnvironment: "jest-environment-jsdom-global",
  testEnvironmentOptions: {
    url: "http://pixelbin/",
  },
  testPathIgnorePatterns: [
    "/static/",
  ],
  collectCoverageFrom: [
    "js/**/*.ts",
    "js/**/*.tsx",
  ],
  coveragePathIgnorePatterns: [
    "<rootDir>/js/.*\\.test\\.ts$",
    "/test-helpers",
  ],
  coverageDirectory: "coverage",
  coverageReporters: [["json", {
    file: "coverage-jest.json",
  }]],
};
