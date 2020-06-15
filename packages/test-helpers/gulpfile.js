const { tsCompile, linter, eslint, tsLint } = require("pixelbin-ci");

exports.build = tsCompile(__dirname);
// exports.test = jest(__dirname);
exports.test = async () => {
  // no-op
};
exports.lint = linter(eslint(__dirname), tsLint(__dirname));
