/* eslint @typescript-eslint/no-explicit-any: "off" */
declare module "vinyl-named" {
  function named(callback?: (file: any) => void): NodeJS.ReadWriteStream;
  export = named;
}
