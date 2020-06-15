import { SpawnOptionsWithoutStdio } from "child_process";

import { Pushable } from "it-pushable";

import { LintedFile, JestConfig } from "./src/types";

// ansi.js
type StyleFunction = (message: string) => string;
type Ansi = {
  red: StyleFunction;
  green: StyleFunction;
  blue: StyleFunction;
  magenta: StyleFunction;
  cyan: StyleFunction;
  white: StyleFunction;
  gray: StyleFunction;
  bgRed: StyleFunction;
  bold: StyleFunction;
  yellow: StyleFunction;
};
export const ansi: Ansi;

// babel.js
export function babel(root: string): () => NodeJS.ReadWriteStream;

// coverage.js
export function mergeCoverage(files: string[], target: string): Promise<void>;

// eslint.js
export function eslint(path: string): AsyncIterable<LintedFile>;

// jest.js
export function jestConfig(): JestConfig;
export function jest(root: string, config?: string): () => Promise<void>;

// karma.js
export function karma(root: string, config?: string): () => Promise<void>;

// lint.js
export function logLints(lints: AsyncIterable<LintedFile>): Promise<boolean>;
export function linter(...lints: AsyncIterable<LintedFile>[]): () => Promise<void>;

// typescript.js
export function tsLint(root: string): AsyncIterable<LintedFile>;
export function tsCompile(root: string): () => Promise<void>;

// utils.js
export function pushable<T>(): Pushable<T>;
export function iterable<T>(fn: (pushable: Pushable<T>) => Promise<void>): () => AsyncIterable<T>;
export function joined<T>(...iterables: AsyncIterable<T>[]): AsyncIterable<T>;
export function exec(
  command: string,
  args?: string[],
  options?: SpawnOptionsWithoutStdio,
): Promise<string[]>;
export function spawn(
  command: string,
  args?: string[],
  options?: SpawnOptionsWithoutStdio,
): Promise<number>;
export function ensureDir(file: string): Promise<void>;
export function findBin(dir: string, name: string): Promise<string>;
