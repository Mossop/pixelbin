const fs = require("fs").promises;
const path = require("path");

const {
  sys,
  parseJsonConfigFileContent,
  createProgram,
  flattenDiagnosticMessageText,
} = require("typescript");

const { logLints } = require("./lint");
const { iterable, pushable } = require("./utils");

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
 * @param {string} configFile
 * @return {Promise<Program>}
 */
async function buildProgram(configFile) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  let data = JSON.parse(await fs.readFile(configFile, {
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
  return createProgram(
    parsed.fileNames,
    parsed.options,
    undefined,
    undefined,
    parsed.errors,
  );
}

/**
 * @param {Program} program
 * @param {string} configFile
 * @return {AsyncIterable<LintedFile>} lints
 */
function listLints(program, configFile) {
  /** @type {import("it-pushable").Pushable<LintedFile>} */
  let lints = pushable();

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

  for (let source of program.getSourceFiles()) {
    lintResults = [
      ...program.getSyntacticDiagnostics(source).map(lintFromDiagnostic),
      ...program.getSemanticDiagnostics(source).map(lintFromDiagnostic),
      ...program.getDeclarationDiagnostics(source).map(lintFromDiagnostic),
    ];

    if (lintResults.length) {
      lints.push({
        path: source.fileName,
        lintResults,
      });
    }
  }

  return lints.end();
}

/**
 * @param {string} root
 * @return {AsyncIterable<LintedFile>}
 */
exports.tsLint = function(root) {
  let configFile = path.join(root, "tsconfig.json");

  return iterable(async function(lints) {
    /** @type {Program} */
    try {
      let program = await buildProgram(configFile);
      for await (let lint of listLints(program, configFile)) {
        lints.push(lint);
      }
    } catch (e) {
      lints.push({
        path: configFile,
        lintResults: [{
          source: "typescript",
          code: "exception",
          message: String(e),
        }],
      });
    }
  });
};

/**
 * @param {string} root
 * @return {() => Promise<void>}
 */
exports.tsCompile = function(root) {
  let configFile = path.join(root, "tsconfig.build.json");

  return async () => {
    /** @type {Program} */
    let program = await buildProgram(configFile);
    let emitResult = program.emit();

    let lints = listLints(program, configFile);
    let succeeded = await logLints(lints);

    if (!succeeded || emitResult.emitSkipped) {
      throw new Error("Failed TypeScript build.");
    }
  };
};
