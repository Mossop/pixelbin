import type { SpawnOptionsWithoutStdio } from "child_process";

import type { Config } from "@jest/types";

export interface LintedFile {
  path: string;
  lintResults: LintInfo[];
}

export interface LintInfo {
  column?: number;
  line?: number;
  source: string;
  code: string;
  message: string;
}

export interface PylintMessage {
  path: string;
  column: number;
  line: number;
  symbol: string;
  message: string;
}

export interface OutputChunk {
  text: string;
  source: "stdout" | "stderr";
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export type ProcessOptions = SpawnOptionsWithoutStdio & {
  encoding?: BufferEncoding;
};

export interface KarmaBrowser {
  readonly id: string;
  readonly fullName: string;
  readonly name: string;
}

export interface KarmaBrowserCollection {
  readonly browsers: readonly KarmaBrowser[];
  readonly getById: (id: string) => KarmaBrowser | null;
}

export interface KarmaInfo {
  readonly total: number;
  readonly specs: Record<string, string[]>;
}

export interface KarmaTestResults {
  readonly disconnected: boolean;
  readonly error: boolean;
  readonly exitCode: number;
  readonly failed: number;
  readonly success: number;
  readonly skipped: number;
}

export interface KarmaSpecResult {
  readonly fullName: string;
  readonly description: string;
  readonly id: string;
  readonly log: unknown[];
  readonly skipped: boolean;
  readonly disabled: boolean;
  readonly pending: boolean;
  readonly success: boolean;
  readonly suite: string[];
  readonly time: number;
  readonly executedExpectationsCount: number;
}

export type JestConfig = Omit<Config.InitialOptions, "coverageReporters"> & {
  coverageReporters: (string | [string, unknown])[];
};
