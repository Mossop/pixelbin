import type { Draft } from "immer";

import type { Api, ObjectModel, Requests } from "../../model";
import { Method } from "../../model";
import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";
import type { CatalogState, MediaState, StorageState } from "./types";
import { mediaIntoState } from "./types";

export async function testStorage(
  storage: Requests.StorageTest,
): Promise<Api.StorageTestResult> {
  return request(Method.StorageTest, storage);
}

export async function createStorage(
  storage: Requests.StorageCreate,
): Promise<Draft<StorageState>> {
  return request(Method.StorageCreate, storage);
}

export async function createCatalog(
  storage: string,
  catalog: Omit<ObjectModel.Catalog, "id">,
): Promise<Draft<CatalogState>> {
  let result = await request(Method.CatalogCreate, {
    storage,
    catalog,
  });

  return {
    ...result,
    albums: new Map(),
    tags: new Map(),
    people: new Map(),
    searches: new Map(),
  };
}

export async function editCatalog(
  catalog: Reference<Catalog>,
  updates: Omit<ObjectModel.Catalog, "id">,
): Promise<Draft<Omit<CatalogState, "albums" | "tags" | "people" | "searches">>> {
  return request(Method.CatalogEdit, {
    id: catalog.id,
    catalog: updates,
  });
}

export async function listCatalogMedia(
  catalog: Reference<Catalog>,
): Promise<Draft<MediaState>[]> {
  let media = await request(Method.CatalogList, {
    id: catalog.id,
  });

  return media.map(mediaIntoState);
}
