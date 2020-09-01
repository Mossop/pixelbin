import { AllNull } from "../utils";
import * as Api from "./api";
import { Metadata, metadataColumns } from "./models";
import * as ObjectModel from "./models";

export { Api, ObjectModel };

export type { Create, Patch, ResponseFor } from "./api";
export { AlternateFileType } from "./models";

export function emptyMetadata(): AllNull<Metadata> {
  return Object.fromEntries(
    metadataColumns.map((column: keyof Metadata): [string, null] => [column, null]),
  ) as AllNull<Metadata>;
}
