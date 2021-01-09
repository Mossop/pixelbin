import { useLocalization } from "@fluent/react";
import type { Theme } from "@material-ui/core/styles";
import { ThemeProvider, createMuiTheme, makeStyles, createStyles } from "@material-ui/core/styles";
import { useMemo, useState } from "react";

import type { Reference } from "../../api/highlevel";
import type { BaseMediaState } from "../../api/types";
import { useElementWidth } from "../../utils/hooks";
import type { MediaGroup } from "../../utils/sort";
import { groupMedia, Grouping, Ordering } from "../../utils/sort";
import type { ReactResult } from "../../utils/types";
import type { PageOption } from "../Banner";
import Loading from "../Loading";
import Page from "../Page";
import MediaDisplay from "./MediaDisplay";
import MediaGallery from "./MediaGallery";

const darkTheme = (theme: Theme): Theme => createMuiTheme({
  ...theme,
  palette: {
    type: "dark",
  },
});

const useStyles = makeStyles(() =>
  createStyles({
    content: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
    },
  }));

export interface MediaListPageProps<T extends BaseMediaState> {
  onMediaClick: (media: T) => void;
  onCloseMedia: () => void;
  galleryTitle: string;
  media: readonly T[] | null | undefined;
  selectedMedia?: string;
  selectedItem?: Reference<unknown>;
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
  let [element, setElement] = useState<Element | null>(null);
  let width = useElementWidth(element);
  let classes = useStyles();

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
      Grouping.Month,
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
          galleryTitle={galleryTitle}
          media={orderedMedia}
          selectedMedia={selectedMedia}
          onChangeMedia={onMediaClick}
          onCloseMedia={onCloseMedia}
        />
      </ThemeProvider>
    }
  >
    <main ref={setElement} className={classes.content}>
      {
        width !== null && mediaGroups
          ? <MediaGallery groups={mediaGroups} width={width} onClick={onMediaClick}/>
          : <Loading flexGrow={1}/>
      }
    </main>
  </Page>;
}
