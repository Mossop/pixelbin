import stream from "stream";

import { CLIEngine, Linter } from "eslint";

import { through, LintInfo, VinylFile } from "./utils";

function lintFromLintMessage(message: Linter.LintMessage): LintInfo {
  return {
    column: message.column,
    line: message.line,
    source: "eslint",
    code: message.ruleId || "",
    message: message.message,
  };
}

export function eslintCheck(): stream.Transform {
  let linter = new CLIEngine({});

  return through((file: VinylFile): Promise<VinylFile> => {
    let report = linter.executeOnFiles([file.path]);
    file.lintResults = report.results[0].messages.map(lintFromLintMessage);
    return Promise.resolve(file);
  });
}
