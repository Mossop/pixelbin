const { tsCompile, linter, eslint, tsLint } = require("pixelbin-ci");

exports.build = tsCompile(__dirname);
exports.lint = linter(eslint(__dirname), tsLint(__dirname));
