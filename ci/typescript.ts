import fs from "fs";
import path from "path";
import stream from "stream";

import { sys, parseJsonConfigFileContent, ParsedCommandLine, createProgram, Program, Diagnostic, DiagnosticWithLocation, flattenDiagnosticMessageText } from "typescript";

import { through, LintInfo, VinylFile } from "./utils";

function isDiagnosticWithLocation(diagnostic: Diagnostic): diagnostic is DiagnosticWithLocation {
  return !!diagnostic.file;
}

function lintFromDiagnostic(diagnostic: Diagnostic): LintInfo {
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

export function typeScriptCheck(configFile: string): stream.Transform {
  let data = JSON.parse(fs.readFileSync(configFile, {
    encoding: "utf8",
  }));

  let parsed: ParsedCommandLine = parseJsonConfigFileContent(data, sys, path.dirname(configFile), undefined, configFile);
  let program: Program = createProgram(parsed.fileNames, parsed.options, undefined, undefined, parsed.errors);

  return through((file: VinylFile): Promise<VinylFile> => {
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
}
