import { useLocalization } from "@fluent/react";
import React, { useCallback, useMemo } from "react";

import type { Reference, SavedSearch } from "../api/highlevel";
import { useReference } from "../api/highlevel";
import type { MediaState } from "../api/types";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import SavedSearchDeleteIcon from "../icons/SavedSearchDeleteIcon";
import SavedSearchEditIcon from "../icons/SavedSearchEditIcon";
import { OverlayType } from "../overlays/types";
import { useActions } from "../store/actions";
import type { SavedSearchMediaLookup } from "../utils/medialookup";
import { MediaLookupType, useMediaLookup } from "../utils/medialookup";
import type { ReactResult } from "../utils/types";
import { PageType } from "./types";

export interface SavedSearchPageProps {
  search: Reference<SavedSearch>;
}

export default function SavedSearchPage({
  search,
}: SavedSearchPageProps): ReactResult {
  let actions = useActions();
  let { l10n } = useLocalization();

  let savedSearch = useReference(search);

  let lookup = useMemo<SavedSearchMediaLookup>(() => ({
    type: MediaLookupType.SavedSearch,
    search,
  }), [search]);

  let onSearchEdit = useCallback(
    () => actions.showOverlay({
      type: OverlayType.SavedSearchEdit,
      search,
    }),
    [actions, search],
  );

  let onSearchDelete = useCallback(
    () => actions.showOverlay({
      type: OverlayType.SavedSearchDelete,
      search,
    }),
    [actions, search],
  );

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

  return <Page
    title={savedSearch.name}
    selectedItem={savedSearch.id}
    pageOptions={
      [{
        id: "saved-search-edit",
        onClick: onSearchEdit,
        icon: <SavedSearchEditIcon/>,
        label: l10n.getString("banner-saved-search-edit"),
      }, {
        id: "saved-search-delete",
        onClick: onSearchDelete,
        icon: <SavedSearchDeleteIcon/>,
        label: l10n.getString("banner-saved-search-delete"),
      }]
    }
  >
    <Content>
      <MediaGallery media={media} onClick={onMediaClick}/>
    </Content>
  </Page>;
}
