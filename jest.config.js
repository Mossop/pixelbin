module.exports = {
  preset: "ts-jest",
  testEnvironment: "jest-environment-jsdom-global",
  testEnvironmentOptions: {
    url: "http://pixelbin/",
  },
  testRegex: [
    "/app/js/.*\\.test\\.[jt]sx?$",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
  ],
  collectCoverageFrom: [
    "app/js/**/*.*",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/app/js/environment/",
    "<rootDir>/app/js/test-helpers/",
    "<rootDir>/app/js/.*\\.karma\\.[jt]sx?$",
    "<rootDir>/app/js/.*\\.test\\.[jt]sx?$",
  ],
  coverageDirectory: "coverage",
  coverageReporters: [["json", {
    file: "jest-coverage.json",
  }]],
  resetModules: true,
  clearMocks: true,
};
