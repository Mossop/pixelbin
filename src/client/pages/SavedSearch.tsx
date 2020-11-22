import React, { useCallback, useMemo } from "react";

import type { MediaState } from "../api/types";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import { useActions } from "../store/actions";
import type { SavedSearchMediaLookup } from "../utils/medialookup";
import { MediaLookupType, useMediaLookup } from "../utils/medialookup";
import type { ReactResult } from "../utils/types";
import { PageType } from "./types";

export interface SavedSearchPageProps {
  searchId: string;
}

export default function SavedSearchPage({
  searchId,
}: SavedSearchPageProps): ReactResult {
  let actions = useActions();

  let lookup = useMemo<SavedSearchMediaLookup>(() => ({
    type: MediaLookupType.SavedSearch,
    search: searchId,
  }), [searchId]);

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

  return <Page title="search" selectedItem={searchId}>
    <Content>
      <MediaGallery media={media} onClick={onMediaClick}/>
    </Content>
  </Page>;
}
