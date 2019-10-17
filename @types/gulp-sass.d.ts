declare module "gulp-sass" {
  import { Options } from "node-sass";

  interface Error {
    file: string;
    messageFormatted: string;
    messageOriginal: string;
    message: string;
    relativePath: string;
  }

  function GulpSass(options?: Options, sync?: boolean): NodeJS.ReadWriteStream;
  export = GulpSass;

  namespace GulpSass {
    function sync(options?: Options): NodeJS.ReadWriteStream;
    function logError(error: Error): void;
  }
}
