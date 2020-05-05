import type { Catalog, Reference } from "./highlevel";
import { ApiMethod, request } from "./types";
import type { TagData } from "./types";

export async function findTag(
  catalog: Reference<Catalog>,
  path: string[],
): Promise<readonly TagData[]> {
  return request(ApiMethod.TagFind, {
    catalog,
    path,
  });
}
