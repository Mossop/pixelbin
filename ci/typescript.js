const fs = require("fs");
const path = require("path");

const {
  sys,
  parseJsonConfigFileContent,
  createProgram,
  flattenDiagnosticMessageText,
} = require("typescript");

const { through } = require("./utils");

/**
 * @typedef { import("stream").Transform } Transform
 * @typedef { import("typescript").ParsedCommandLine } ParsedCommandLine
 * @typedef { import("typescript").Program } Program
 * @typedef { import("typescript").Diagnostic } Diagnostic
 * @typedef { import("typescript").DiagnosticWithLocation } DiagnosticWithLocation
 * @typedef { import("./utils").LintInfo } LintInfo
 * @typedef { import("./utils").VinylFile } VinylFile
 */

/**
 * @param {Diagnostic} diagnostic
 * @return {diagnostic is DiagnosticWithLocation}
 */
function isDiagnosticWithLocation(diagnostic) {
  return !!diagnostic.file;
}

/**
 * @param {Diagnostic} diagnostic
 * @return {LintInfo}
 */
function lintFromDiagnostic(diagnostic) {
  if (isDiagnosticWithLocation(diagnostic)) {
    let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return {
      column: character + 1,
      line: line + 1,
      source: "typescript",
      code: String(diagnostic.code),
      message: flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    };
  } else {
    return {
      source: "typescript",
      code: String(diagnostic.code),
      message: flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    };
  }
}

/**
 * @param {string} configFile
 * @return {Transform}
 */
exports.typeScriptCheck = function(configFile) {
  let data = JSON.parse(fs.readFileSync(configFile, {
    encoding: "utf8",
  }));

  /** @type {ParsedCommandLine} */
  let parsed = parseJsonConfigFileContent(
    data,
    sys,
    path.dirname(configFile),
    undefined,
    configFile,
  );

  /** @type {Program} */
  let program = createProgram(
    parsed.fileNames,
    parsed.options,
    undefined,
    undefined,
    parsed.errors,
  );

  return through(file => {
    if (file.path === configFile) {
      file.lintResults = [
        ...program.getConfigFileParsingDiagnostics().map(lintFromDiagnostic),
        ...program.getOptionsDiagnostics().map(lintFromDiagnostic),
        ...program.getGlobalDiagnostics().map(lintFromDiagnostic),
      ];

      return Promise.resolve(file);
    }

    let source = program.getSourceFile(file.path);
    if (!source) {
      return Promise.resolve(file);
    }

    file.lintResults = [
      ...program.getSyntacticDiagnostics(source).map(lintFromDiagnostic),
      ...program.getSemanticDiagnostics(source).map(lintFromDiagnostic),
      ...program.getDeclarationDiagnostics(source).map(lintFromDiagnostic),
    ];

    return Promise.resolve(file);
  });
};
