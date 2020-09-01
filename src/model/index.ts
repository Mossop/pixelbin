import { AllNull } from "../utils";
import { Metadata, metadataColumns } from "./models";

export * as Api from "./api";
export * as ObjectModel from "./models";

export type { Create, Patch, ResponseFor } from "./api";
export { AlternateFileType } from "./models";

export function emptyMetadata(): AllNull<Metadata> {
  return Object.fromEntries(
    metadataColumns.map((column: keyof Metadata): [string, null] => [column, null]),
  ) as AllNull<Metadata>;
}
