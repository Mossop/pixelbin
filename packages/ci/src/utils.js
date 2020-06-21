const fs = require("fs").promises;
const path = require("path");

/**
 * @template T
 * @return {import("it-pushable").Pushable<T>}
 */
function pushable() {
  // @ts-ignore: The type definitions for it-pushable are incorrect.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return require("it-pushable")();
}
exports.pushable = pushable;

/**
 * @typedef { import("./types").OutputChunk } OutputChunk
 * @typedef { import("./types").LintInfo } LintInfo
 * @typedef { import("./types").Deferred } Deferred
 * @typedef { import("./types").ProcessOptions } ProcessOptions
 * @typedef { import("child_process").SpawnOptions } SpawnOptions
 * @typedef { import("child_process").SpawnOptionsWithoutStdio } SpawnOptionsWithoutStdio
 */

/**
 * @template T
 * @param {(pushable: import("it-pushable").Pushable<T>) => Promise<void>} fn
 * @returns {AsyncIterable<T>}
 */
function iterable(fn) {
  return {
    [Symbol.asyncIterator]() {
      /** @type import("it-pushable").Pushable<T> */
      let pusher = pushable();

      fn(pusher).then(() => pusher.end(), error => pusher.end(error));
      return pusher[Symbol.asyncIterator]();
    },
  };
}
exports.iterable = iterable;

/**
 * @template T
 * @param {AsyncIterable<T>[]} iterables
 * @return {AsyncIterable<T>}
 */
function joined(...iterables) {
  return {
    [Symbol.asyncIterator]() {
      /** @type {import("it-pushable").Pushable<T>} */
      let buffer = pushable();

      /**
       * @param {AsyncIterable<T>} iterable
       * @return {Promise<void>}
       */
      async function launch(iterable) {
        for await (let item of iterable) {
          buffer.push(item);
        }
      }

      Promise.all(iterables.map(launch)).then(
        () => buffer.end(),
        err => buffer.end(err),
      );

      return buffer[Symbol.asyncIterator]();
    },
  };
}
exports.joined = joined;

/**
 * @param {string} file
 * @return {Promise<void>}
 */
exports.ensureDir = async function(file) {
  await fs.mkdir(path.dirname(file), {
    recursive: true,
  });
};

/**
 * @param {string} dir
 * @param {string} name
 * @return {Promise<string>}
 */
exports.findBin = async function(dir, name) {
  while (dir != "/") {
    let bin = path.join(dir, "node_modules", ".bin", name);
    try {
      await fs.stat(bin);
      return bin;
    } catch (e) {
      // Missing file.
    }
    dir = path.dirname(dir);
  }

  throw new Error(`Unable to find ${name} binary.`);
};
