const { linter, eslint, tsLint } = require("./src");

exports.build = async () => {
  // no-op
};
exports.test = async () => {
  // no-op
};
exports.lint = linter(eslint(__dirname), tsLint(__dirname));
