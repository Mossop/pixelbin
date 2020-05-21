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
