import type { Draft } from "immer";

import type { Query } from "../../model";
import { Method } from "../../model";
import { request } from "./api";
import type { Reference, SavedSearch, Catalog } from "./highlevel";
import type { MediaState, SavedSearchState } from "./types";
import { searchIntoState, mediaIntoState } from "./types";

export async function searchMedia(
  catalog: Reference<Catalog>,
  query: Query,
): Promise<Draft<MediaState>[]> {
  let results = await request(Method.MediaSearch, {
    catalog: catalog.id,
    query,
  });
  return results.map(mediaIntoState);
}

export async function createSavedSearch(
  catalog: Reference<Catalog>,
  search: Omit<SavedSearchState, "id" | "catalog">,
): Promise<Draft<SavedSearchState>> {
  return request(Method.SavedSearchCreate, {
    catalog: catalog.id,
    search,
  }).then(searchIntoState);
}

export async function editSavedSearch(
  search: Reference<SavedSearch>,
  updates: Partial<Omit<SavedSearchState, "id" | "catalog">>,
): Promise<Draft<SavedSearchState>> {
  return request(Method.SavedSearchEdit, {
    id: search.id,
    search: updates,
  }).then(searchIntoState);
}

export async function deleteSavedSearches(
  searches: string[],
): Promise<void> {
  await request(Method.SavedSearchDelete, searches);
}
