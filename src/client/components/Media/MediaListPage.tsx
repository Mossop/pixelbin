import { useLocalization } from "@fluent/react";
import { ThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import React, { useMemo } from "react";

import type { BaseMediaState } from "../../api/types";
import type { MediaGroup } from "../../utils/sort";
import { groupMedia, Grouping, Ordering } from "../../utils/sort";
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

export interface MediaListPageProps<T extends BaseMediaState> {
  onMediaClick: (media: T) => void;
  onCloseMedia: () => void;
  galleryTitle: string;
  media: readonly T[] | null | undefined;
  selectedMedia?: string;
  selectedItem?: string;
  pageOptions?: PageOption[];
}

export default function MediaListPage<T extends BaseMediaState>({
  onMediaClick,
  onCloseMedia,
  galleryTitle,
  media,
  selectedMedia,
  selectedItem,
  pageOptions,
}: MediaListPageProps<T>): ReactResult {
  let { l10n } = useLocalization();

  let {
    mediaGroups,
    orderedMedia,
  } = useMemo(() => {
    if (!media) {
      return {
        mediaGroups: null,
        orderedMedia: null,
      };
    }

    let mediaGroups = groupMedia(
      Grouping.Year,
      false,
      Ordering.Date,
      false,
      media,
    );

    let orderedMedia: T[] = [];
    orderedMedia = orderedMedia.concat(
      ...mediaGroups.map((group: MediaGroup<T>): T[] => group.media),
    );

    return {
      mediaGroups,
      orderedMedia,
    };
  }, [media]);

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
        <MediaDisplay
          media={orderedMedia}
          selectedMedia={selectedMedia}
          onChangeMedia={onMediaClick}
          onCloseMedia={onCloseMedia}
        />
      </ThemeProvider>
    }
  >
    {
      mediaGroups
        ? <Content>
          <MediaGallery groups={mediaGroups} onClick={onMediaClick}/>
        </Content>
        : <Loading flexGrow={1}/>
    }

  </Page>;
}
