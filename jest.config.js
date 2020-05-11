module.exports = {
  preset: "ts-jest",
  testEnvironment: "jest-environment-jsdom-global",
  testEnvironmentOptions: {
    url: "http://pixelbin/",
  },
  testRegex: [
    "/app/tests/(.+/)?[^\\./][^/]*\\.[jt]sx?$",
    "/app/js/.*\\.test.[jt]sx?$",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/app/tests/helpers/",
  ],
  collectCoverageFrom: [
    "app/js/**/*.*",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/app/js/environment/",
    "<rootDir>/app/js/test-helpers/",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", ["json", {
    file: "coverage.json",
  }]],
  resetModules: true,
  clearMocks: true,
};
