import { useLocalization } from "@fluent/react";
import { createMuiTheme, ThemeProvider } from "@material-ui/core/styles";
import React, { useCallback, useMemo } from "react";

import { getSharedSearchResults } from "../api/search";
import type { SharedMediaWithMetadataState } from "../api/types";
import Content from "../components/Content";
import Loading from "../components/Loading";
import MediaDisplay from "../components/Media/MediaDisplay";
import MediaGallery from "../components/Media/MediaGallery";
import Page from "../components/Page";
import { useActions } from "../store/actions";
import { usePromise } from "../utils/hooks";
import type { ReactResult } from "../utils/types";
import { PageType } from "./types";

const darkTheme = createMuiTheme({
  palette: {
    type: "dark",
  },
});

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

  if (searchResults === null) {
    return <Page title={l10n.getString("notfound-page-title")}/>;
  }

  return <Page
    title={title}
    overlay={
      selectedMedia &&
      <ThemeProvider theme={darkTheme}>
        {
          searchResults
            ? <MediaDisplay
              media={searchResults.media}
              selectedMedia={selectedMedia}
              onChangeMedia={onMediaClick}
              onCloseMedia={onCloseMedia}
            />
            : <Loading height="100%" width="100%"/>
        }
      </ThemeProvider>
    }
  >
    {
      searchResults
        ? <Content>
          <MediaGallery media={searchResults.media} onClick={onMediaClick}/>
        </Content>
        : <Loading height="100%" width="100%"/>
    }
  </Page>;
}
