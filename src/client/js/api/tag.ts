import type { Catalog, Reference } from "./highlevel";
import { TagState } from "./types";

export async function findTag(
  _catalog: Reference<Catalog>,
  _path: string[],
): Promise<readonly TagState[]> {
  return [];
}
