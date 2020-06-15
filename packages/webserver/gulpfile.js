const { jest, tsCompile, linter, eslint, tsLint } = require("pixelbin-ci");

exports.build = tsCompile(__dirname);
const jestTest = jest(__dirname);
exports.jest = jestTest;
exports.test = jestTest;
exports.lint = linter(eslint(__dirname), tsLint(__dirname));
