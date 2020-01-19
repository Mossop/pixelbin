import {request } from "./api";
import { Catalog, Reference } from "./highlevel";
import { TagData, ApiMethod } from "./types";

export async function findTag(catalog: Reference<Catalog>, path: string[]): Promise<TagData[]> {
  return request(ApiMethod.TagFind, {
    catalog,
    path,
  });
}
