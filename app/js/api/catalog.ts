import { StorageData } from "../storage";
import { request } from "./api";
import { ApiMethod, CatalogData } from "./types";

export function createCatalog(name: string, storage: StorageData): Promise<CatalogData> {
  return request(ApiMethod.CatalogCreate, {
    name,
    storage,
  });
}
