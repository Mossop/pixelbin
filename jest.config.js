module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testRegex: [
    "\\.test\\.[jt]sx?$",
  ],
  testPathIgnorePatterns: [
    "/build/",
    "/packages/",
    "/src/client/",
    "/node_modules/",
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.ts",
  ],
  coveragePathIgnorePatterns: [
    "<rootDir>/src/.*\\.test\\.ts$",
    "<rootDir>/src/client/.*",
  ],
  coverageDirectory: "coverage",
  coverageReporters: [["json", {
    file: "coverage-jest.json",
  }]],
  setupFilesAfterEnv: [
    "jest-mock-console/dist/setupTestFramework.js",
  ],
  resetModules: true,
  clearMocks: true,
};
