const { JsonDecoder } = require("ts.data.json");

const { path } = require("../base/config");
const { exec, iterable } = require("./utils");

/**
 * @typedef {import("./types").LintInfo} LintInfo
 * @typedef {import("./types").LintedFile} LintedFile
 * @typedef {import("./types").PylintMessage} PylintMessage
 */

/** @type {import("ts.data.json").JsonDecoder.Decoder<PylintMessage>} */
const PylintDecoder = JsonDecoder.object({
  path: JsonDecoder.string,
  column: JsonDecoder.number,
  line: JsonDecoder.number,
  symbol: JsonDecoder.string,
  message: JsonDecoder.string,
}, "PylintMessage");

/**
 * @param {PylintMessage} message
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
 * @type {() => AsyncIterable<LintedFile>}
 */
exports.pylint = iterable(async function(lints) {
  /** @type {Map<string, LintedFile>} */
  let files = new Map();

  let cmdLine = [`--rcfile=${path(".pylintrc")}`, "--exit-zero", "-f", "json", "api", "config"];
  let stdout = await exec("pylint", cmdLine);

  /** @type {PylintMessage[]} */
  let data;
  try {
    data = await JsonDecoder.array(PylintDecoder, "PylintMessage[]")
      .decodePromise(JSON.parse(stdout.join("\n")));
  } catch (e) {
    throw new Error(`Failed to parse pylint output: ${e}\n${stdout.join("\n")}`);
  }

  for (let lint of data) {
    let file = files.get(lint.path);
    if (!file) {
      file = {
        path: lint.path,
        lintResults: [],
      };
      files.set(lint.path, file);
    }

    file.lintResults.push(lintFromPylint(lint));
  }

  for (let file of files.values()) {
    lints.push(file);
  }
});
