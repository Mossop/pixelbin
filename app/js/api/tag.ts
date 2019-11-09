import { buildJSONBody, request } from "./api";
import { Tag, Catalog, TagDecoder } from "./types";
import { intoId, MapId } from "../utils/maps";

export async function findTag(catalog: MapId<Catalog>, path: string[]): Promise<Tag> {
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
