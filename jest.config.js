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
  collectCoverageFrom: [
    "src/**/*.ts",
  ],
  coveragePathIgnorePatterns: [
    "<rootDir>/src/.*\\.test\\.ts$",
    "<rootDir>/src/client/.*",
    "/test-helpers",
  ],
  coverageDirectory: "coverage/server",
  coverageReporters: [["json", {
    file: "coverage-final.json",
  }]],
  setupFilesAfterEnv: [
    "jest-mock-console/dist/setupTestFramework.js",
  ],
  resetModules: true,
  clearMocks: true,
  testTimeout: 10000,
};
