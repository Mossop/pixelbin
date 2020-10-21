import { Draft } from "immer";

import { Api, Method } from "../../model";
import { request } from "./api";
import { Catalog, Reference } from "./highlevel";
import { CatalogState, mediaIntoState, MediaState, StorageState } from "./types";

export async function testStorage(
  storage: Api.StorageTestRequest,
): Promise<Api.StorageTestResult> {
  return request(Method.StorageTest, storage);
}

export async function createStorage(
  storage: Api.StorageCreateRequest,
): Promise<StorageState> {
  return request(Method.StorageCreate, storage);
}

export async function createCatalog(
  name: string,
  storage: string,
): Promise<CatalogState> {
  let result = await request(Method.CatalogCreate, {
    name,
    storage,
  });

  return {
    ...result,
    albums: new Map(),
    tags: new Map(),
    people: new Map(),
    searches: new Map(),
  };
}

export async function listCatalogMedia(
  catalog: Reference<Catalog>,
): Promise<Draft<MediaState>[]> {
  let media = await request(Method.CatalogList, {
    id: catalog.id,
  });

  return media.map(mediaIntoState);
}
