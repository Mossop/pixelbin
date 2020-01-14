import { intoId, MapId } from "../utils/maps";
import {request } from "./api";
import { Catalog } from "./highlevel";
import { TagData, ApiMethod, CatalogData } from "./types";

export async function findTag(catalog: MapId<Catalog | CatalogData>, path: string[]): Promise<TagData> {
  return request(ApiMethod.TagFind, {
    catalog: intoId(catalog),
    path,
  });
}
