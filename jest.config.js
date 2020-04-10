module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testRegex: [
    "app/tests/[^\\.].*\\.[jt]sx?",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/utils.tsx",
  ],
  collectCoverageFrom: [
    "app/js/**/*.(ts|js|tsx|jsx)",
  ],
};
