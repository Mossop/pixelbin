import { postJSONRequest } from "./api";
import { StorageConfig } from "../storage";
import { Catalog, CatalogDecoder } from "../types";

export async function createCatalog(name: string, storage: StorageConfig): Promise<Catalog> {
  let request = await postJSONRequest("createCatalog", {
    name,
    storage
  });

  if (request.ok) {
    return CatalogDecoder.decodePromise(await request.json());
  } else {
    throw new Error("Login failed");
  }
}
