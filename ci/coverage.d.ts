import { ReportOptions } from "istanbul-reports";

export function mergeCoverage(files: string[], target: string): Promise<void>;
export function reportCoverage<T extends keyof ReportOptions>(
  file: string,
  name: T,
  options?: ReportOptions[T],
): Promise<void>;
