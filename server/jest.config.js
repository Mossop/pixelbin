module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testRegex: [
    "\\.test\\.[jt]sx?$",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
  ],
  collectCoverageFrom: [
    "**/*.ts",
  ],
  coveragePathIgnorePatterns: [
    "<rootDir>/.*\\.test\\.ts$",
  ],
  coverageDirectory: "coverage",
  coverageReporters: [["json", {
    file: "jest-coverage.json",
  }]],
  resetModules: true,
  clearMocks: true,

  // We only have one test database.
  maxConcurrency: 1,
};
