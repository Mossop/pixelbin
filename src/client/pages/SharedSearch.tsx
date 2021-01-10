import { useLocalization } from "@fluent/react";
import type { Draft } from "immer";
import { useCallback, useMemo } from "react";

import { getSharedSearchResults } from "../api/search";
import type { SharedMediaWithMetadataState } from "../api/types";
import MediaListPage from "../components/Media/MediaListPage";
import type { UIState } from "../store/types";
import { usePromise } from "../utils/hooks";
import { goBack } from "../utils/navigation";
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
  let searchResults = usePromise(useMemo(() => {
    return getSharedSearchResults(search);
  }, [search]));

  let title = useMemo(() => {
    if (!searchResults) {
      return l10n.getString("loading-title");
    }
    return searchResults.name;
  }, [l10n, searchResults]);

  let getMediaUIState = useCallback((media: SharedMediaWithMetadataState): Draft<UIState> => {
    return {
      page: {
        type: PageType.SharedSearch,
        search,
        selectedMedia: media.id,
      },
    };
  }, [search]);

  let onCloseMedia = useCallback((): void => {
    goBack({
      page: {
        type: PageType.SharedSearch,
        search,
        selectedMedia: undefined,
      },
    });
  }, [search]);

  return <MediaListPage
    getMediaUIState={getMediaUIState}
    onCloseMedia={onCloseMedia}
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
    media={searchResults && searchResults.media}
    galleryTitle={title}
    selectedMedia={selectedMedia}
  />;
}
