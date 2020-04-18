import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";
import { ApiMethod } from "./types";
import type { TagData } from "./types";

export async function findTag(catalog: Reference<Catalog>, path: string[]): Promise<TagData[]> {
  return request(ApiMethod.TagFind, {
    catalog,
    path,
  });
}
