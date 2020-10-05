import { Draft } from "immer";
import { useEffect, useState } from "react";

import { Query } from "../../model";
import { listAlbumMedia } from "../api/album";
import { listCatalogMedia } from "../api/catalog";
import { Album, Catalog, Reference } from "../api/highlevel";
import { getMedia, searchMedia } from "../api/media";
import { MediaState } from "../api/types";

export enum MediaLookupType {
  Single,
  Album,
  Catalog,
  Search,
}

export interface AlbumMediaLookup {
  type: MediaLookupType.Album;
  album: Reference<Album>;
  recursive: boolean;
}

export interface CatalogMediaLookup {
  type: MediaLookupType.Catalog;
  catalog: Reference<Catalog>;
}

export interface SingleMediaLookup {
  type: MediaLookupType.Single;
  media: string;
}

export interface SearchMediaLookup {
  type: MediaLookupType.Search;
  catalog: Reference<Catalog>;
  query: Query;
}

export type MediaLookup =
  AlbumMediaLookup |
  CatalogMediaLookup |
  SingleMediaLookup |
  SearchMediaLookup;

function isMedia(item: Draft<MediaState> | null): item is Draft<MediaState> {
  return !!item;
}

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
  }
}

export function useMediaLookup(lookup: MediaLookup): readonly MediaState[] | null {
  const [list, setList] = useState<readonly MediaState[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    lookupMedia(lookup).then((media: readonly MediaState[]): void => {
      if (!cancelled) {
        setList(media);
      }
    }).catch(() => {
      if (!cancelled) {
        setList([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lookup]);

  return list;
}
