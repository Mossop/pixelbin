import { spawn as launch } from "child_process";
import type { SpawnOptions, ChildProcess } from "child_process";
import type { Readable, Stream, Writable } from "stream";

import type { Deferred } from "../../utils/defer";
import { defer } from "../../utils/defer";

type IOType = "pipe" | "ignore" | "inherit";
type InputType = IOType | Process[];
type OutputType = IOType | Process;

export class Process {
  private starting: boolean;
  private _stdin: InputType;
  private _stdout: OutputType;
  private _stderr: OutputType;
  private _exitCode: Deferred<number>;
  private _process: ChildProcess | null;

  public constructor(
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly options: SpawnOptions = {},
  ) {
    this.starting = false;

    this._stdin = "inherit";
    this._stdout = "inherit";
    this._stderr = "inherit";

    const safe = (val: number | IOType | "ipc" | Stream | null | undefined): IOType => {
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

    this._exitCode = defer();
    this._process = null;
  }

  private pipingFrom(process: Process): void {
    if (!Array.isArray(this._stdin)) {
      this._stdin = [];
    }

    this._stdin.push(process);
  }

  public pipe(process: Process): void {
    if (this._process) {
      throw new Error("Cannot pipe a process after it has started.");
    }

    this._stdout = process;
    process.pipingFrom(this);
  }

  public pipeStdErr(process: Process): void {
    if (this._process) {
      throw new Error("Cannot pipe a process after it has started.");
    }

    this._stderr = process;
    process.pipingFrom(this);
  }

  private start(): void {
    if (this._process || this.starting) {
      return;
    }

    // Re-entrancy check.
    this.starting = true;

    /**
     * @param {"pipe" | "inherit" | "ignore" | Process | Process[]} io
     * @return {"pipe" | "inherit" | "ignore"}
     */
    const toIO = (
      io: "pipe" | "inherit" | "ignore" | Process | Process[],
    ): "pipe" | "inherit" | "ignore" => {
      if (Array.isArray(io) || io instanceof Process) {
        return "pipe";
      }
      return io;
    };

    let stdio = [toIO(this._stdin), toIO(this._stdout), toIO(this._stderr)];

    this._process = launch(this.command, this.args, {
      ...this.options,
      stdio,
    });

    this._process.on("exit", (code: number | null): void => {
      if (typeof code != "number") {
        code = -1;
      }
      this._exitCode.resolve(code);
    });

    this._process.on("error", (error: Error): void => {
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
      this._stdin.forEach((process: Process) => {
        process.start();
      });
    }

    this.starting = false;
  }

  public get stdin(): Writable | null {
    this.start();
    return this._process?.stdin ?? null;
  }

  public get stdout(): Readable | null {
    this.start();
    return this._process?.stdout ?? null;
  }

  public get stderr(): Readable | null {
    this.start();
    return this._process?.stderr ?? null;
  }

  public kill(signal: NodeJS.Signals | number): boolean {
    if (!this._process) {
      throw new Error("Attempt to kill a process that hasn't started.");
    }

    return this._process.kill(signal);
  }

  public get pid(): number {
    this.start();

    return this._process?.pid ?? -1;
  }

  public get exitCode(): Promise<number> {
    this.start();

    return this._exitCode.promise;
  }
}
exports.Process = Process;
