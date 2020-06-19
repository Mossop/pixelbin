const fs = require("fs").promises;
const path = require("path");

const { series } = require("gulp");
const { tsCompile, jest, linter, eslint, tsLint } = require("pixelbin-ci");

exports.build = series(tsCompile(__dirname), async () => {
  // Knex dislikes .d.ts files in the migrations directory. We don't really need them.
  let migrationDir = path.join(__dirname, "build", "migrations");

  let migrations = await fs.readdir(migrationDir);
  for (let file of migrations) {
    if (file.endsWith(".d.ts")) {
      await fs.unlink(path.join(migrationDir, file));
    }
  }
});

const jestTest = jest(__dirname);
exports.jest = jestTest;
exports.test = jestTest;
exports.lint = linter(eslint(__dirname), tsLint(__dirname));
