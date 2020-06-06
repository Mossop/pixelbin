module.exports = {
  preset: "ts-jest",
  testEnvironment: "jest-environment-jsdom-global",
  testEnvironmentOptions: {
    url: "http://pixelbin/",
  },
  testRegex: [
    "/js/.*\\.test\\.[jt]sx?$",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
  ],
  collectCoverageFrom: [
    "js/**/*.*",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "<rootDir>/js/environment/",
    "<rootDir>/js/test-helpers/",
    "<rootDir>/js/.*\\.karma\\.[jt]sx?$",
    "<rootDir>/js/.*\\.test\\.[jt]sx?$",
  ],
  coverageDirectory: "coverage",
  coverageReporters: [["json", {
    file: "coverage-final.json",
  }]],
  resetModules: true,
  clearMocks: true,
};
