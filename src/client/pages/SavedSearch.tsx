import { useLocalization } from "@fluent/react";
import React, { useCallback, useMemo } from "react";

import type { Reference, SavedSearch } from "../api/highlevel";
import { useReference } from "../api/highlevel";
import type { MediaState } from "../api/types";
import MediaListPage from "../components/Media/MediaListPage";
import { DialogType } from "../dialogs/types";
import SavedSearchDeleteIcon from "../icons/SavedSearchDeleteIcon";
import SavedSearchEditIcon from "../icons/SavedSearchEditIcon";
import { useActions } from "../store/actions";
import type { SavedSearchMediaLookup } from "../utils/medialookup";
import { useMediaLookup, MediaLookupType } from "../utils/medialookup";
import type { ReactResult } from "../utils/types";
import { PageType } from "./types";

export interface SavedSearchPageProps {
  search: Reference<SavedSearch>;
  selectedMedia?: string;
}

export default function SavedSearchPage({
  search,
  selectedMedia,
}: SavedSearchPageProps): ReactResult {
  let actions = useActions();
  let { l10n } = useLocalization();

  let savedSearch = useReference(search);

  let lookup = useMemo<SavedSearchMediaLookup>(() => ({
    type: MediaLookupType.SavedSearch,
    search,
  }), [search]);

  let media = useMediaLookup(lookup);

  let onSearchEdit = useCallback(
    () => actions.showDialog({
      type: DialogType.SavedSearchEdit,
      search,
    }),
    [actions, search],
  );

  let onSearchDelete = useCallback(
    () => actions.showDialog({
      type: DialogType.SavedSearchDelete,
      search,
    }),
    [actions, search],
  );

  let onMediaClick = useCallback((media: MediaState): void => {
    actions.navigate({
      page: {
        type: PageType.SavedSearch,
        search,
        selectedMedia: media.id,
      },
    });
  }, [actions, search]);

  let onCloseMedia = useCallback((): void => {
    actions.navigate({
      page: {
        type: PageType.SavedSearch,
        search,
      },
    });
  }, [actions, search]);

  return <MediaListPage
    media={media}
    galleryTitle={savedSearch.name}
    selectedItem={savedSearch.id}
    selectedMedia={selectedMedia}
    onMediaClick={onMediaClick}
    onCloseMedia={onCloseMedia}
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
  />;
}
