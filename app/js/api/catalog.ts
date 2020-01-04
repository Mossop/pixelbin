import { Draft } from "../utils/immer";
import { StorageConfig } from "../storage/types";
import { buildJSONBody, request } from "./api";
import { Catalog, CatalogDecoder } from "./types";

export async function createCatalog(name: string, storage: StorageConfig): Promise<Draft<Catalog>> {
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
