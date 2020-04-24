import { ApiMethod } from ".";
import type { TagData } from ".";
import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";

export async function findTag(
  catalog: Reference<Catalog>,
  path: string[],
): Promise<readonly TagData[]> {
  return request(ApiMethod.TagFind, {
    catalog,
    path,
  });
}
