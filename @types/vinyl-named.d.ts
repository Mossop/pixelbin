/* eslint @typescript-eslint/no-explicit-any: "off" */
declare module "vinyl-named" {
  function Named(callback?: (file: any) => void): NodeJS.ReadWriteStream;
  export = Named;
}
