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
    file: "coverage-final.json",
  }]],
  resetModules: true,
  clearMocks: true,
};
