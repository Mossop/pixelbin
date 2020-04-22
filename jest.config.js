module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    url: "http://pixelbin/",
  },
  testRegex: [
    "/app/tests/(.+/)?[^\\./][^/]*\\.[jt]sx?$",
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
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", ["json", {
    file: "coverage.json",
  }]],
  resetModules: true,
};
