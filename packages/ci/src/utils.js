const { spawn } = require("child_process");
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
 * @template T
 * @return {import("./types").Deferred<T>}
 */
function defer() {
  let resolve = null;
  let reject = null;
  let promise = new Promise((resolver, rejecter) => {
    resolve = resolver;
    reject = rejecter;
  });

  // @ts-ignore: TypeScript cannot infer that resolve and reject are always non-null here.
  return { promise, resolve, reject };
}

exports.Process = class Process {
  /**
   * @param {string} command
   * @param {string[]} args
   * @param {ProcessOptions} options
   */
  constructor(command, args = [], options = {}) {
    /** @type {import("./types").Deferred<number>} */
    let exitCode = defer();
    this._exitCode = exitCode.promise;

    this._process = spawn(command, args, {
      ...options,
      stdio: ["inherit", "pipe", "pipe"],
    });

    this._process.stdout.setEncoding(options.encoding ?? "utf8");
    /** @type {import("it-pushable").Pushable<string>} */
    this._stdout = pushable();
    this._process.stdout.on("data", chunk => {
      this._stdout.push(chunk);
    });

    this._process.stderr.setEncoding(options.encoding ?? "utf8");
    /** @type {import("it-pushable").Pushable<string>} */
    this._stderr = pushable();
    this._process.stderr.on("data", chunk => {
      this._stderr.push(chunk);
    });

    this._process.on("close", () => {
      this._stdout.end();
      this._stderr.end();
    });

    this._process.on("exit", code => {
      if (typeof code != "number") {
        code = -1;
      }
      exitCode.resolve(code);
    });

    this._process.on("error", error => {
      exitCode.reject(error);
      this._stdout.end(error);
      this._stderr.end(error);
    });
  }

  /**
   * @param {NodeJS.Signals | number} [signal]
   * @return {boolean}
   */
  kill(signal) {
    return this._process.kill(signal);
  }

  /**
   * @return {number}
   */
  get pid() {
    return this._process.pid;
  }

  /**
   * @return {Promise<number>}
   */
  get exitCode() {
    return this._exitCode;
  }

  /**
   * @return {AsyncIterable<string>}
   */
  get stdout() {
    return this._stdout;
  }

  /**
   * @return {AsyncIterable<string>}
   */
  get stderr() {
    return this._stderr;
  }

  [Symbol.asyncIterator]() {
    return this.stdout[Symbol.asyncIterator]();
  }
};
const Process = exports.Process;

/**
 * @param {string} command
 * @param {string[]} args
 * @param {SpawnOptionsWithoutStdio} options
 * @return {Promise<string[]>}
 */
exports.exec = async function(command, args = [], options = {}) {
  /** @type {string[]} */
  let output = [];

  let process = new Process(command, args, {
    shell: true,
    ...options,
  });

  for await (let chunk of joined(process.stdout, process.stderr)) {
    output.push(...chunk.split("\n"));
  }

  return output;
};

/**
 * @param {string} command
 * @param {string[]} args
 * @param {SpawnOptionsWithoutStdio} options
 * @return {Promise<number>}
 */
exports.spawn = async function(command, args = [], options = {}) {
  let process = spawn(command, args, {
    ...options,
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    process.on("exit", code => {
      if (typeof code != "number") {
        code = -1;
      }
      resolve(code);
    });

    process.on("error", error => {
      reject(error);
    });
  });
};

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
