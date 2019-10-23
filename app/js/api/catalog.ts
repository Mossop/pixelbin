import { buildJSONBody, request } from "./api";
import { StorageConfig } from "../storage/types";
import { Catalog, CatalogDecoder } from "./types";

export async function createCatalog(name: string, storage: StorageConfig): Promise<Catalog> {
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
