const config = root => ({
  displayName: root,

  preset: "ts-jest",
  setupFilesAfterEnv: [
    "jest-mock-console/dist/setupTestFramework.js",
  ],
  resetModules: true,
  clearMocks: true,

  testMatch: [
    `<rootDir>/src/${root}/**/*.test.{js,jsx,ts,tsx}`,
  ],
  testPathIgnorePatterns: [
    "<rootDir>/build/",
    "<rootDir>/packages/",
    "<rootDir>/node_modules/",
  ],
  coveragePathIgnorePatterns: [
    "\\.(test|karma)\\.[jt]sx?$",
    "/test-helpers",
    "/\\.",
    "\\.config\\.js$",
  ],
});

module.exports = {
  testTimeout: 10000,
  collectCoverageFrom: [
    "<rootDir>/src/**/*.{js,jsx,ts,tsx}",
  ],

  coverageDirectory: "coverage",
  coverageReporters: [["json", {
    file: "coverage-jest.json",
  }]],

  projects: [{
    ...config("server"),

    testEnvironment: "node",
  }, {
    ...config("utils"),

    testEnvironment: "node",
  }, {
    ...config("client"),

    testEnvironment: "jest-environment-jsdom-global",
    testEnvironmentOptions: {
      url: "http://pixelbin/",
    },
  }],
};
