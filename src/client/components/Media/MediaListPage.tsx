import { useLocalization } from "@fluent/react";
import { ThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import React, { useMemo } from "react";

import type { MediaState } from "../../api/types";
import type { MediaLookup } from "../../utils/medialookup";
import { useMediaLookup } from "../../utils/medialookup";
import type { ReactResult } from "../../utils/types";
import type { PageOption } from "../Banner";
import Content from "../Content";
import Loading from "../Loading";
import Page from "../Page";
import MediaDisplay from "./MediaDisplay";
import MediaGallery from "./MediaGallery";

const darkTheme = createMuiTheme({
  palette: {
    type: "dark",
  },
});

export interface MediaListPageProps {
  onMediaClick: (media: MediaState) => void;
  onCloseMedia: () => void;
  lookup: MediaLookup;
  selectedMedia?: string;
  selectedItem?: string;
  pageOptions?: PageOption[];
}

export default function MediaListPage({
  onMediaClick,
  onCloseMedia,
  lookup,
  selectedMedia,
  selectedItem,
  pageOptions,
}: MediaListPageProps): ReactResult {
  let { l10n } = useLocalization();
  let mediaResults = useMediaLookup(lookup);
  let title = useMemo(() => {
    if (!mediaResults) {
      return l10n.getString("loading-title");
    }
    return mediaResults.title ?? "";
  }, [l10n, mediaResults]);

  if (mediaResults === null) {
    return <Page
      title={l10n.getString("notfound-page-title")}
      selectedItem={selectedItem}
      pageOptions={pageOptions}
    />;
  }

  return <Page
    title={title}
    selectedItem={selectedItem}
    pageOptions={pageOptions}
    overlay={
      selectedMedia &&
      <ThemeProvider theme={darkTheme}>
        {
          mediaResults
            ? <MediaDisplay
              media={mediaResults.media}
              selectedMedia={selectedMedia}
              onChangeMedia={onMediaClick}
              onCloseMedia={onCloseMedia}
            />
            : <Loading height="100%" width="100%"/>
        }
      </ThemeProvider>
    }
  >
    <Content>
      {
        mediaResults
          ? <MediaGallery media={mediaResults.media} onClick={onMediaClick}/>
          : <Loading height="100%" width="100%"/>
      }
    </Content>
  </Page>;
}
