import { CLIEngine } from "eslint";

declare function Eslint(options?: CLIEngine.Options): NodeJS.ReadWriteStream;

export = Eslint;

type Formatter<O> = string | (<O>(results: CLIEngine.LintResult[]) => O);
type Outputter<O> = NodeJS.WritableStream | (<O>(output: O) => void);

declare namespace Eslint {
  export function Result(action: (result: CLIEngine.LintResult) => void): NodeJS.ReadWriteStream;
  export function Results(action: (results: CLIEngine.LintReport) => void): NodeJS.ReadWriteStream;
  export function FailOnError(): NodeJS.ReadWriteStream;
  export function FailAfterError(): NodeJS.ReadWriteStream;
  export function Format<O>(formatter?: Formatter<O>, outputter?: Outputter<O>): NodeJS.ReadWriteStream;
  export function FormatEach<O>(formatter?: Formatter<O>, outputter?: Outputter<O>): NodeJS.ReadWriteStream;
}
