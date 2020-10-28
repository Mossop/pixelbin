import type { Api, Query } from "../../model";
import { Method } from "../../model";
import { request } from "./api";
import type { Reference, SavedSearch } from "./highlevel";
import { Catalog } from "./highlevel";
import type { MediaState, SavedSearchState } from "./types";
import { mediaIntoState } from "./types";

export async function searchMedia(
  catalog: Reference<Catalog>,
  query: Query,
): Promise<MediaState[]> {
  let results = await request(Method.MediaSearch, {
    catalog: catalog.id,
    query,
  });
  return results.map(mediaIntoState);
}

export async function createSavedSearch(
  catalog: Reference<Catalog>,
  query: Query,
  name: string,
  shared: boolean,
): Promise<SavedSearchState> {
  let search = await request(Method.SavedSearchCreate, {
    catalog: catalog.id,
    query,
    name,
    shared,
  });

  return {
    ...search,
    catalog: Catalog.ref(search.catalog),
  };
}

export async function editSavedSearch(
  search: Reference<SavedSearch>,
  data: Partial<Pick<Api.SavedSearch, "name" | "query">>,
): Promise<SavedSearchState> {
  let updated = await request(Method.SavedSearchEdit, {
    ...data,
    id: search.id,
  });

  return {
    ...updated,
    catalog: Catalog.ref(updated.catalog),
  };
}

export async function deleteSavedSearches(
  searches: string[],
): Promise<void> {
  await request(Method.SavedSearchDelete, searches);
}
