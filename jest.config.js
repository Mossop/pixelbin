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
  coverageDirectory: "coverage",
  coverageReporters: ["text", ["json", {
    file: "coverage.json",
  }]],
  resetModules: true,
};
