const fs = require("fs").promises;

const { createCoverageMap } = require("istanbul-lib-coverage");

const { ensureDir } = require("./utils");

/**
 * @param {string[]} files
 * @param {string} target
 * @return {Promise<void>}
 */
exports.mergeCoverage = async function mergeCoverage(files, target) {
  let map = createCoverageMap();
  for (let file of files) {
    try {
      await fs.stat(file);
      map.merge(JSON.parse(await fs.readFile(file, {
        encoding: "utf8",
      })));
    } catch (e) {
      // Missing or bad file.
    }
  }

  await ensureDir(target);
  await fs.writeFile(target, JSON.stringify(map.toJSON()));
};
