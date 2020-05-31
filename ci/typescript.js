const fs = require("fs").promises;

const {
  sys,
  parseJsonConfigFileContent,
  createProgram,
  flattenDiagnosticMessageText,
} = require("typescript");

const { path } = require("../base/config");
const { iterable } = require("./utils");

/**
 * @typedef { import("stream").Transform } Transform
 * @typedef { import("typescript").ParsedCommandLine } ParsedCommandLine
 * @typedef { import("typescript").Program } Program
 * @typedef { import("typescript").Diagnostic } Diagnostic
 * @typedef { import("typescript").DiagnosticWithLocation } DiagnosticWithLocation
 * @typedef { import("./types").LintedFile } LintedFile
 * @typedef { import("./types").LintInfo } LintInfo
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
 * @type {() => AsyncIterable<LintedFile>}
 */
exports.typescript = iterable(async function(lints) {
  let configFile = path("tsconfig.json");
  let data = JSON.parse(await fs.readFile(configFile, {
    encoding: "utf8",
  }));

  /** @type {ParsedCommandLine} */
  let parsed = parseJsonConfigFileContent(
    data,
    sys,
    path(),
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

  let lintResults = [
    ...program.getConfigFileParsingDiagnostics().map(lintFromDiagnostic),
    ...program.getOptionsDiagnostics().map(lintFromDiagnostic),
    ...program.getGlobalDiagnostics().map(lintFromDiagnostic),
  ];

  if (lintResults.length) {
    lints.push({
      path: configFile,
      lintResults,
    });
  }

  for (let file of parsed.fileNames) {
    let source = program.getSourceFile(file);
    if (!source) {
      continue;
    }

    lintResults = [
      ...program.getSyntacticDiagnostics(source).map(lintFromDiagnostic),
      ...program.getSemanticDiagnostics(source).map(lintFromDiagnostic),
      ...program.getDeclarationDiagnostics(source).map(lintFromDiagnostic),
    ];

    if (lintResults.length) {
      lints.push({
        path: file,
        lintResults,
      });
    }
  }
});
