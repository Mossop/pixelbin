const { jestConfig } = require("pixelbin-ci");

module.exports = {
  ...jestConfig(),
  testEnvironment: "jest-environment-jsdom-global",
  testEnvironmentOptions: {
    url: "http://pixelbin/",
  },
  coverageReporters: [["json", {
    file: "jest-coverage.json",
  }]],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/src/environment/",
    "<rootDir>/src/test-helpers/",
    "<rootDir>/src/.*\\.karma\\.[jt]sx?$",
    "<rootDir>/src/.*\\.test\\.[jt]sx?$",
  ],
};
