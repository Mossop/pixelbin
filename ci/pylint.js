const through2 = require("through2");

const { path } = require("../base/config");
const { exec } = require("./utils");

/**
 * @typedef { import("stream").Transform } Transform
 * @typedef { import("./utils").LintInfo } LintInfo
 * @typedef { import("./utils").VinylFile } VinylFile
 */

/**
 * @param {any} message
 * @return {LintInfo}
 */
function lintFromPylint(message) {
  return {
    column: message.column + 1,
    line: message.line,
    source: "pylint",
    code: message.symbol,
    message: message.message,
  };
}

/**
 * @param {string[]} args
 * @return {Transform}
 */
exports.pylintCheck = function(args = []) {
  /** @type {Map<string, VinylFile>} */
  let files = new Map();

  return through2.obj((file, _, callback) => {
    files.set(file.path, file);
    callback();
  }, function(callback) {
    let cmdLine = [...args, "--exit-zero", "-f", "json", ...files.keys()];
    exec("pylint", cmdLine).then(stdout => {
      /** @type {any} */
      let data;
      try {
        data = JSON.parse(stdout.join("\n"));
      } catch (e) {
        console.error(`Failed to parse pylint output: ${e}`);
        console.log(stdout.join("\n"));
        callback();
        return;
      }

      for (let lint of data) {
        let file = files.get(path(lint.path));
        if (file) {
          if (!file.lintResults) {
            file.lintResults = [];
          }

          file.lintResults.push(lintFromPylint(lint));
        } else {
          console.error(`Missing file for ${lint.path}`);
        }
      }

      for (let file of files.values()) {
        this.push(file);
      }
      callback();
    }, e => {
      console.error(e);
      callback();
    });
  });
};
