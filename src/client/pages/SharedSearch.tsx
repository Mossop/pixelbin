import { useLocalization } from "@fluent/react";
import React, { useCallback, useMemo } from "react";

import { getSharedSearchResults } from "../api/search";
import type { SharedMediaWithMetadataState } from "../api/types";
import MediaListPage from "../components/Media/MediaListPage";
import { useActions } from "../store/actions";
import { usePromise } from "../utils/hooks";
import type { ReactResult } from "../utils/types";
import { PageType } from "./types";

export interface SharedSearchPageProps {
  search: string;
  selectedMedia?: string;
}

export default function SharedSearchPage({
  search,
  selectedMedia,
}: SharedSearchPageProps): ReactResult {
  let { l10n } = useLocalization();
  let actions = useActions();
  let searchResults = usePromise(useMemo(() => {
    return getSharedSearchResults(search);
  }, [search]));

  let title = useMemo(() => {
    if (!searchResults) {
      return l10n.getString("loading-title");
    }
    return searchResults.name;
  }, [l10n, searchResults]);

  let onMediaClick = useCallback((media: SharedMediaWithMetadataState): void => {
    actions.navigate({
      page: {
        type: PageType.SharedSearch,
        search,
        selectedMedia: media.id,
      },
    });
  }, [search, actions]);

  let onCloseMedia = useCallback((): void => {
    actions.navigate({
      page: {
        type: PageType.SharedSearch,
        search,
        selectedMedia: undefined,
      },
    });
  }, [search, actions]);

  return <MediaListPage
    onMediaClick={onMediaClick}
    onCloseMedia={onCloseMedia}
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    media={searchResults && searchResults.media}
    galleryTitle={title}
    selectedMedia={selectedMedia}
    selectedItem={search}
  />;
}
