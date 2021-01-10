import { useLocalization } from "@fluent/react";
import type { Draft } from "immer";
import { useCallback, useMemo } from "react";

import type { Reference } from "../api/highlevel";
import { useReference, SavedSearch } from "../api/highlevel";
import type { MediaState } from "../api/types";
import MediaListPage from "../components/Media/MediaListPage";
import { DialogType } from "../dialogs/types";
import SavedSearchDeleteIcon from "../icons/SavedSearchDeleteIcon";
import SavedSearchEditIcon from "../icons/SavedSearchEditIcon";
import { useActions } from "../store/actions";
import type { UIState } from "../store/types";
import type { SavedSearchMediaLookup } from "../utils/medialookup";
import { useMediaLookup, MediaLookupType } from "../utils/medialookup";
import { goBack } from "../utils/navigation";
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

  let savedSearch = useReference(SavedSearch, search);

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

  let getMediaUIState = useCallback((media: MediaState): Draft<UIState> => {
    return {
      page: {
        type: PageType.SavedSearch,
        search,
        selectedMedia: media.id,
      },
    };
  }, [search]);

  let onCloseMedia = useCallback((): void => {
    goBack({
      page: {
        type: PageType.SavedSearch,
        search,
      },
    });
  }, [search]);

  let pageOptions = useMemo(() => [{
    id: "saved-search-edit",
    onClick: onSearchEdit,
    icon: <SavedSearchEditIcon/>,
    label: l10n.getString("banner-saved-search-edit"),
  }, {
    id: "saved-search-delete",
    onClick: onSearchDelete,
    icon: <SavedSearchDeleteIcon/>,
    label: l10n.getString("banner-saved-search-delete"),
  }], [l10n, onSearchDelete, onSearchEdit]);

  return <MediaListPage
    media={media}
    galleryTitle={savedSearch.name}
    selectedItem={search}
    selectedMedia={selectedMedia}
    getMediaUIState={getMediaUIState}
    onCloseMedia={onCloseMedia}
    pageOptions={pageOptions}
  />;
}
