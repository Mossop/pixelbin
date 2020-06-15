const { jest, tsCompile, linter, eslint, tsLint } = require("pixelbin-ci");

exports.build = tsCompile(__dirname);
exports.test = jest(__dirname);
exports.lint = linter(eslint(__dirname), tsLint(__dirname));
