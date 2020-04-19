module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    url: "http://pixelbin/",
  },
  testRegex: [
    "app/tests/.+/.*\\.[jt]sx?",
  ],
  testPathIgnorePatterns: [
    "app/tests/utils.tsx",
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
