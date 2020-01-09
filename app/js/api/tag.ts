import { intoId, MapId } from "../utils/maps";
import { buildJSONBody, request } from "./api";
import { TagData, CatalogData, TagDecoder } from "./types";
import { Catalog } from "./highlevel";

export async function findTag(catalog: MapId<Catalog | CatalogData>, path: string[]): Promise<TagData> {
  return request({
    url: "tag/find",
    method: "POST",
    body: buildJSONBody({
      catalog: intoId(catalog),
      path,
    }),
    decoder: TagDecoder,
  });
}
