import { useLocalization } from "@fluent/react";
import EditIcon from "@material-ui/icons/Edit";
import SaveIcon from "@material-ui/icons/Save";
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

  let lookup = useMemo<SearchMediaLookup>(() => ({
    type: MediaLookupType.Search,
    catalog,
    query,
  }), [catalog, query]);

  let onMediaClick = useCallback((media: MediaState): void => {
    actions.navigate({
      page: {
        type: PageType.Media,
        media: media.id,
        lookup,
      },
    });
  }, [actions, lookup]);

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

  let onSaveSearch = useCallback(() => {
    // @ts-ignore
    let newQuery: Draft<Query> = {
      ...query,
    };

    actions.showOverlay({
      type: OverlayType.SaveSearch,
      catalog,
      query: newQuery,
    });
  }, [actions, catalog, query]);

  return <Page
    pageOptions={
      [{
        id: "edit-search",
        onClick: onEditSearch,
        icon: <EditIcon/>,
        label: l10n.getString("banner-edit-search"),
      }, {
        id: "save-search",
        onClick: onSaveSearch,
        icon: <SaveIcon/>,
        label: l10n.getString("banner-save-search"),
      }]
    }
  >
    <Content>
      <MediaGallery media={media} onClick={onMediaClick}/>
    </Content>
  </Page>;
}
