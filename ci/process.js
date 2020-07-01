const { spawn: launch } = require("child_process");

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

/**
 * @typedef {"pipe" | "ignore" | "inherit"} IOType
 * @typedef {IOType | Process} OutputType
 * @typedef {IOType | Process[]} InputType
 */

class Process {
  /**
   * @param {string} command
   * @param {string[]} args
   * @param {import("child_process").SpawnOptions} options
   */
  constructor(command, args = [], options = {}) {
    this._command = command;
    this._args = args;
    this._options = options;
    this._starting = false;

    /** @type {InputType} */
    this._stdin = "inherit";
    /** @type {OutputType} */
    this._stdout = "inherit";
    /** @type {OutputType} */
    this._stderr = "inherit";

    /**
     * @param {number | IOType | "ipc" | import("stream").Stream | null | undefined} val
     * @return {IOType}
     */
    const safe = val => {
      switch (val) {
        case "pipe":
        case "ignore":
        case "inherit":
          return val;
      }

      return "inherit";
    };

    if (Array.isArray(options.stdio)) {
      [this._stdin, this._stdout, this._stderr] = options.stdio.map(safe);
    } else if (options.stdio) {
      [this._stdin, this._stdout, this._stderr] = [options.stdio, options.stdio, options.stdio];
    } else {
      [this._stdin, this._stdout, this._stderr] = ["inherit", "inherit", "inherit"];
    }

    /** @type {import("./types").Deferred<number>} */
    this._exitCode = defer();
    this._process = null;
  }

  /**
   * @param {Process} process
   * @return {void}
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _pipingFrom(process) {
    if (!Array.isArray(this._stdin)) {
      this._stdin = [];
    }

    this._stdin.push(process);
  }

  /**
   * @param {Process} process
   * @return {void}
   */
  pipe(process) {
    if (this._process) {
      throw new Error("Cannot pipe a process after it has started.");
    }

    this._stdout = process;
    process._pipingFrom(this);
  }

  /**
   * @param {Process} process
   * @return {void}
   */
  pipeStdErr(process) {
    if (this._process) {
      throw new Error("Cannot pipe a process after it has started.");
    }

    this._stderr = process;
    process._pipingFrom(this);
  }

  /**
   * @return {void}
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _start() {
    if (this._process || this._starting) {
      return;
    }

    // Re-entrancy check.
    this._starting = true;

    /**
     * @param {"pipe" | "inherit" | "ignore" | Process | Process[]} io
     * @return {"pipe" | "inherit" | "ignore"}
     */
    const toIO = io => {
      if (Array.isArray(io) || io instanceof Process) {
        return "pipe";
      }
      return io;
    };

    let stdio = [toIO(this._stdin), toIO(this._stdout), toIO(this._stderr)];

    this._process = launch(this._command, this._args, {
      ...this._options,
      stdio,
    });

    this._process.on("exit", code => {
      if (typeof code != "number") {
        code = -1;
      }
      this._exitCode.resolve(code);
    });

    this._process.on("error", error => {
      this._exitCode.reject(error);
    });

    if (this._stdout instanceof Process) {
      let stream = this._stdout.stdin;
      if (stream) {
        this._process.stdout?.pipe(stream);
      }
    }

    if (this._stderr instanceof Process) {
      let stream = this._stderr.stdin;
      if (stream) {
        this._process.stderr?.pipe(stream);
      }
    }

    if (Array.isArray(this._stdin)) {
      this._stdin.forEach(process => {
        process._start();
      });
    }

    this._starting = false;
  }

  get stdin() {
    this._start();
    return this._process?.stdin;
  }

  get stdout() {
    this._start();
    return this._process?.stdout;
  }

  get stderr() {
    this._start();
    return this._process?.stderr;
  }

  /**
   * @param {NodeJS.Signals | number} [signal]
   * @return {boolean}
   */
  kill(signal) {
    if (!this._process) {
      throw new Error("Attempt to kill a process that hasn't started.");
    }

    return this._process.kill(signal);
  }

  /**
   * @return {number}
   */
  get pid() {
    this._start();

    return this._process?.pid ?? -1;
  }

  /**
   * @return {Promise<number>}
   */
  get exitCode() {
    this._start();

    return this._exitCode.promise;
  }
}
exports.Process = Process;

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import("child_process").SpawnOptionsWithoutStdio} options
 * @return {Promise<number>}
 */
exports.spawn = function(command, args = [], options = {}) {
  let process = new Process(command, args, options);
  return process.exitCode;
};

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import("child_process").SpawnOptionsWithoutStdio} options
 * @return {Promise<void>}
 */
exports.checkSpawn = async function(command, args = [], options = {}) {
  let exitCode = await exports.spawn(command, args, options);
  if (exitCode != 0) {
    let ran = [
      command,
      ...args,
    ];
    throw new Error(`Running "${ran.join(" ")}" exited with exit code ${exitCode}`);
  }
};
