import { Api } from "../../../model";
import { request } from "./api";
import { CatalogState } from "./types";

export async function createCatalog(
  name: string,
  storage: string | Api.Create<Api.Storage>,
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
