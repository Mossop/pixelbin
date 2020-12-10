import { useEffect, useState } from "react";

import type { Query } from "../../model";
import { memoized } from "../../utils/memo";
import { listAlbumMedia } from "../api/album";
import { listCatalogMedia } from "../api/catalog";
import type { Reference } from "../api/highlevel";
import { Catalog, SavedSearch, Album } from "../api/highlevel";
import { getMedia } from "../api/media";
import { searchMedia } from "../api/search";
import type { MediaState, ServerState } from "../api/types";
import { useSelector } from "../store";
import type { StoreState } from "../store/types";
import { mediaTitle } from "./metadata";

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
  ): Promise<MediaResults | null> {
    switch (lookup.type) {
      case MediaLookupType.Album: {
        let album = Album.safeFromState(serverState, lookup.album.id);
        if (!album) {
          return null;
        }

        return {
          title: album.name,
          media: await listAlbumMedia(lookup.album, lookup.recursive),
        };
      }
      case MediaLookupType.Catalog: {
        let catalog = Catalog.safeFromState(serverState, lookup.catalog.id);
        if (!catalog) {
          return null;
        }

        return {
          title: catalog.name,
          media: await listCatalogMedia(lookup.catalog),
        };
      }
      case MediaLookupType.Single: {
        let [media] = await getMedia([lookup.media]);
        if (!media) {
          return null;
        }

        return {
          title: mediaTitle(media),
          media: [media],
        };
      }
      case MediaLookupType.Search: {
        return {
          title: null,
          media: await searchMedia(lookup.catalog, lookup.query),
        };
      }
      case MediaLookupType.SavedSearch: {
        let search = SavedSearch.safeFromState(serverState, lookup.search.id);
        if (!search) {
          return null;
        }

        return {
          title: search.name,
          media: await searchMedia(search.catalog.ref(), search.query),
        };
      }
    }
  },
);

export interface MediaResults {
  readonly title: string | null;
  readonly media: readonly MediaState[];
}

export function useMediaLookup(lookup: MediaLookup): MediaResults | null | undefined {
  let [results, setResults] = useState<MediaResults | null | undefined>(undefined);
  let serverState = useSelector((state: StoreState) => state.serverState);

  useEffect(() => {
    let cancelled = false;

    lookupMedia(serverState, lookup).then((results: MediaResults | null): void => {
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
