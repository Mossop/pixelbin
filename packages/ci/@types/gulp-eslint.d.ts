declare module "gulp-eslint" {
  import { CLIEngine } from "eslint";

  function gulpEslint(options?: CLIEngine.Options): NodeJS.ReadWriteStream;
  export = gulpEslint;

  namespace gulpEslint {
    type Formatter<O> = string | (<O>(results: CLIEngine.LintResult[]) => O);
    type Outputter<O> = NodeJS.WritableStream | (<O>(output: O) => void);

    function result(action: (result: CLIEngine.LintResult) => void): NodeJS.ReadWriteStream;
    function results(action: (results: CLIEngine.LintReport) => void): NodeJS.ReadWriteStream;
    function failOnError(): NodeJS.ReadWriteStream;
    function failAfterError(): NodeJS.ReadWriteStream;
    function format<O>(formatter?: Formatter<O>, outputter?: Outputter<O>): NodeJS.ReadWriteStream;
    function formatEach<O>(formatter?: Formatter<O>, outputter?: Outputter<O>):
    NodeJS.ReadWriteStream;
  }
}
