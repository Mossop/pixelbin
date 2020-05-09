import type { StorageData } from "../storage";
import request from "./request";
import { ApiMethod } from "./types";
import type { CatalogData } from "./types";

export function createCatalog(name: string, storage: StorageData): Promise<CatalogData> {
  return request(ApiMethod.CatalogCreate, {
    name,
    storage,
  });
}
