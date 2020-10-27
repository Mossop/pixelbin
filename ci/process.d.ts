import type { SpawnOptionsWithoutStdio, SpawnOptions } from "child_process";
import type { Writable, Readable } from "stream";

declare class Process {
  public constructor(command: string, args?: string[], options?: SpawnOptions);
  public pipe(process: Process): void;
  public pipeStdErr(process: Process): void;
  public readonly stdin: Writable | null;
  public readonly stdout: Readable | null;
  public readonly stderr: Readable | null;
  public kill(signal: NodeJS.Signals | number): boolean;
  public readonly pid: number;
  public readonly exitCode: Promise<number>;
}

export function spawn(
  command: string,
  args?: string[],
  options?: SpawnOptionsWithoutStdio,
): Promise<number>;

export function checkSpawn(
  command: string,
  args?: string[],
  options?: SpawnOptionsWithoutStdio,
): Promise<void>;
