import { buildJSONBody, request } from "./api";
import { StorageConfig } from "../storage/types";
import { Catalog, CatalogDecoder } from "../types";

export async function createCatalog(name: string, storage: StorageConfig): Promise<Catalog> {
  let response = await request("catalog/create", "PUT", buildJSONBody({
    name,
    storage
  }));

  if (response.ok) {
    return CatalogDecoder.decodePromise(await response.json());
  } else {
    throw new Error("Failed to create catalog.");
  }
}
