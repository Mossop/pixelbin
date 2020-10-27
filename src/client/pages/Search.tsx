import { useLocalization } from "@fluent/react";
import type { Draft } from "immer";
import React, { useCallback, useMemo } from "react";

import type { Query } from "../../model";
import type { Catalog, Reference } from "../api/highlevel";
import type { MediaState } from "../api/types";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import { OverlayType } from "../overlays/types";
import { useActions } from "../store/actions";
import type { SearchMediaLookup } from "../utils/medialookup";
import { MediaLookupType, useMediaLookup } from "../utils/medialookup";
import type { ReactResult } from "../utils/types";
import type { AuthenticatedPageProps } from "./types";
import { PageType } from "./types";

export interface SearchPageProps {
  catalog: Reference<Catalog>;
  query: Query;
}

export default function SearchPage({
  query,
  catalog,
}: SearchPageProps & AuthenticatedPageProps): ReactResult {
  let { l10n } = useLocalization();
  let actions = useActions();

  let onMediaClick = useCallback((media: MediaState): void => {
    actions.navigate({
      page: {
        type: PageType.Media,
        media: media.id,
        lookup: {
          type: MediaLookupType.Search,
          catalog,
          query,
        },
      },
    });
  }, [actions, catalog, query]);

  let lookup = useMemo<SearchMediaLookup>(() => ({
    type: MediaLookupType.Search,
    catalog,
    query,
  }), [catalog, query]);

  let media = useMediaLookup(lookup);

  let onEditSearch = useCallback(() => {
    // @ts-ignore
    let newQuery: Draft<Query> = {
      ...query,
    };

    actions.showOverlay({
      type: OverlayType.Search,
      catalog,
      query: newQuery,
    });
  }, [actions, catalog, query]);

  return <Page
    pageOptions={
      [{
        id: "edit-search",
        onClick: onEditSearch,
        label: l10n.getString("banner-edit-search"),
      }]
    }
  >
    <Content>
      <MediaGallery media={media} onClick={onMediaClick}/>
    </Content>
  </Page>;
}
