import type { Draft } from "immer";

import type { Api, Query } from "../../model";
import { Method } from "../../model";
import { request } from "./api";
import type { Reference, SavedSearch, Catalog } from "./highlevel";
import { refId } from "./highlevel";
import type { MediaState, SavedSearchState, SharedSearchResults } from "./types";
import { sharedMediaIntoState, searchIntoState, mediaIntoState } from "./types";

export async function searchMedia(
  catalog: Reference<Catalog>,
  query: Query,
): Promise<Draft<MediaState>[]> {
  let results = await request(Method.MediaSearch, {
    catalog: refId(catalog),
    query,
  });
  return Promise.all(results.map(mediaIntoState));
}

export async function createSavedSearch(
  catalog: Reference<Catalog>,
  search: Omit<SavedSearchState, "id" | "catalog">,
): Promise<Draft<SavedSearchState>> {
  return request(Method.SavedSearchCreate, {
    catalog: refId(catalog),
    search,
  }).then(searchIntoState);
}

export async function editSavedSearch(
  search: Reference<SavedSearch>,
  updates: Partial<Omit<SavedSearchState, "id" | "catalog">>,
): Promise<Draft<SavedSearchState>> {
  return request(Method.SavedSearchEdit, {
    id: refId(search),
    search: updates,
  }).then(searchIntoState);
}

export async function deleteSavedSearch(
  search: Reference<SavedSearch>,
): Promise<void> {
  await request(Method.SavedSearchDelete, [refId(search)]);
}

export async function getSharedSearchResults(search: string): Promise<SharedSearchResults | null> {
  let results = await request(Method.SharedSearch, {
    id: search,
  });

  if (!results) {
    return null;
  }

  let media = await Promise.all(results.media.map((media: Api.SharedMediaWithMetadata) => {
    return sharedMediaIntoState(media, search);
  }));

  return {
    name: results.name,
    media,
  };
}