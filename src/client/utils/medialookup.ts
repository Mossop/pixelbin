import { useEffect, useState } from "react";

import type { Query } from "../../model";
import { memoized } from "../../utils/memo";
import { listAlbumMedia } from "../api/album";
import { listCatalogMedia } from "../api/catalog";
import type { Reference, Catalog, Album } from "../api/highlevel";
import { refId, SavedSearch } from "../api/highlevel";
import { getMedia } from "../api/media";
import { searchMedia } from "../api/search";
import type { MediaState, ServerState } from "../api/types";
import { useServerState } from "../store";

export enum MediaLookupType {
  Single,
  Album,
  Catalog,
  Search,
  SavedSearch,
}

export interface AlbumMediaLookup {
  readonly type: MediaLookupType.Album;
  readonly album: Reference<Album>;
  readonly recursive: boolean;
}

export interface CatalogMediaLookup {
  readonly type: MediaLookupType.Catalog;
  readonly catalog: Reference<Catalog>;
}

export interface SingleMediaLookup {
  readonly type: MediaLookupType.Single;
  readonly media: string;
}

export interface SearchMediaLookup {
  readonly type: MediaLookupType.Search;
  readonly catalog: Reference<Catalog>;
  readonly query: Query;
}

export interface SavedSearchMediaLookup {
  readonly type: MediaLookupType.SavedSearch;
  readonly search: Reference<SavedSearch>;
}

export type MediaLookup =
  AlbumMediaLookup |
  CatalogMediaLookup |
  SingleMediaLookup |
  SearchMediaLookup |
  SavedSearchMediaLookup;

export const lookupMedia = memoized(
  async function lookupMedia(
    serverState: ServerState,
    lookup: MediaLookup,
  ): Promise<readonly MediaState[] | null> {
    switch (lookup.type) {
      case MediaLookupType.Album: {
        return listAlbumMedia(lookup.album, lookup.recursive);
      }
      case MediaLookupType.Catalog: {
        return listCatalogMedia(lookup.catalog);
      }
      case MediaLookupType.Single: {
        let [media] = await getMedia([lookup.media]);
        if (!media) {
          return null;
        }

        return [media];
      }
      case MediaLookupType.Search: {
        return searchMedia(lookup.catalog, lookup.query);
      }
      case MediaLookupType.SavedSearch: {
        let search = SavedSearch.safeFromState(serverState, refId(lookup.search));
        if (!search) {
          return null;
        }

        return searchMedia(search.catalog.ref(), search.query);
      }
    }
  },
);

export function useMediaLookup(lookup: MediaLookup): readonly MediaState[] | null | undefined {
  let [results, setResults] = useState<readonly MediaState[] | null | undefined>(undefined);
  let serverState = useServerState();

  useEffect(() => {
    let cancelled = false;
    setResults(undefined);

    lookupMedia(serverState, lookup).then((results: readonly MediaState[] | null): void => {
      if (!cancelled) {
        setResults(results);
      }
    }).catch((e: unknown) => {
      if (!cancelled) {
        console.error(e);
        setResults(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lookup, serverState]);

  return results;
}
