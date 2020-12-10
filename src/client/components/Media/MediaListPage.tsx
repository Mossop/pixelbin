import { useLocalization } from "@fluent/react";
import { ThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import React from "react";

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
  galleryTitle: string;
  lookup: MediaLookup;
  selectedMedia?: string;
  selectedItem?: string;
  pageOptions?: PageOption[];
}

export default function MediaListPage({
  onMediaClick,
  onCloseMedia,
  galleryTitle,
  lookup,
  selectedMedia,
  selectedItem,
  pageOptions,
}: MediaListPageProps): ReactResult {
  let { l10n } = useLocalization();
  let media = useMediaLookup(lookup);

  if (media === null) {
    return <Page
      title={l10n.getString("notfound-page-title")}
      selectedItem={selectedItem}
      pageOptions={pageOptions}
    />;
  }

  return <Page
    title={galleryTitle}
    selectedItem={selectedItem}
    pageOptions={pageOptions}
    overlay={
      selectedMedia &&
      <ThemeProvider theme={darkTheme}>
        {
          media
            ? <MediaDisplay
              media={media}
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
      media
        ? <Content>
          <MediaGallery media={media} onClick={onMediaClick}/>
        </Content>
        : <Loading height="100%" width="100%"/>
    }

  </Page>;
}
