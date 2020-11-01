import type { Draft } from "immer";
import { useEffect, useState } from "react";

import type { Query } from "../../model";
import { memoized } from "../../utils";
import { listAlbumMedia } from "../api/album";
import { listCatalogMedia } from "../api/catalog";
import type { Album, Catalog, Reference } from "../api/highlevel";
import { getMedia } from "../api/media";
import { searchMedia } from "../api/search";
import type { MediaState } from "../api/types";

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
  readonly search: string;
}

export type MediaLookup =
  AlbumMediaLookup |
  CatalogMediaLookup |
  SingleMediaLookup |
  SearchMediaLookup |
  SavedSearchMediaLookup;

function isMedia(item: Draft<MediaState> | null): item is Draft<MediaState> {
  return !!item;
}

export const lookupMedia = memoized(
  async function lookupMedia(lookup: MediaLookup): Promise<readonly MediaState[]> {
    switch (lookup.type) {
      case MediaLookupType.Album: {
        return listAlbumMedia(lookup.album, lookup.recursive);
      }
      case MediaLookupType.Catalog: {
        return listCatalogMedia(lookup.catalog);
      }
      case MediaLookupType.Single: {
        let media = await getMedia([lookup.media]);
        return media.filter(isMedia);
      }
      case MediaLookupType.Search: {
        return searchMedia(lookup.catalog, lookup.query);
      }
      case MediaLookupType.SavedSearch: {
        return [];
      }
    }
  },
);

export function useMediaLookup(lookup: MediaLookup): readonly MediaState[] | null {
  let [list, setList] = useState<readonly MediaState[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    lookupMedia(lookup).then((media: readonly MediaState[]): void => {
      if (!cancelled) {
        setList(media);
      }
    }).catch((e: unknown) => {
      if (!cancelled) {
        console.error(e);
        setList([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lookup]);

  return list;
}
