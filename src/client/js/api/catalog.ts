import { Api, Create, ObjectModel } from "../../../model";
import { request } from "./api";
import { CatalogState, StorageState } from "./types";

export async function createStorage(
  storage: Create<Omit<ObjectModel.Storage, "owner">>,
): Promise<StorageState> {
  return request(Api.Method.StorageCreate, storage);
}

export async function createCatalog(
  name: string,
  storage: string,
): Promise<CatalogState> {
  let result = await request(Api.Method.CatalogCreate, {
    name,
    storage,
  });

  return {
    ...result,
    albums: new Map(),
    tags: new Map(),
    people: new Map(),
  };
}
