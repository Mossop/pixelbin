const { linter, eslint, tsLint } = require("./src");

exports.lint = linter(eslint(__dirname), tsLint(__dirname));
