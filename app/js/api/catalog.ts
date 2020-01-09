import { StorageConfig } from "../storage/types";
import { buildJSONBody, request } from "./api";
import { CatalogData, CatalogDecoder } from "./types";

export async function createCatalog(name: string, storage: StorageConfig): Promise<CatalogData> {
  return request({
    url: "catalog/create",
    method: "PUT",
    body: buildJSONBody({
      name,
      storage
    }),
    decoder: CatalogDecoder,
  });
}
