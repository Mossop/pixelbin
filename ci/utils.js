const { promises: fs } = require("fs");
const path = require("path");

/**
 * @param {string} file
 * @return {Promise<void>}
 */
exports.ensureDir = async function(file) {
  await fs.mkdir(path.dirname(file), {
    recursive: true,
  });
};

/**
 * @param {string} dir
 * @param {string} name
 * @return {Promise<string>}
 */
exports.findBin = async function(dir, name) {
  while (dir != "/") {
    let bin = path.join(dir, "node_modules", ".bin", name);
    try {
      await fs.stat(bin);
      return bin;
    } catch (e) {
      // Missing file.
    }
    dir = path.dirname(dir);
  }

  throw new Error(`Unable to find ${name} binary.`);
};
