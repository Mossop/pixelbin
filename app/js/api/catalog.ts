import { ApiMethod } from ".";
import type { CatalogData } from ".";
import type { StorageData } from "../storage";
import { request } from "./api";

export function createCatalog(name: string, storage: StorageData): Promise<CatalogData> {
  return request(ApiMethod.CatalogCreate, {
    name,
    storage,
  });
}
