import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import React, { useMemo } from "react";

import type { MediaState } from "../../api/types";
import { isProcessedMedia } from "../../api/types";
import Loading from "../../components/Loading";
import Page from "../../components/Page";
import { useActions } from "../../store/actions";
import type { UIState } from "../../store/types";
import type { MediaLookup } from "../../utils/medialookup";
import { MediaLookupType, useMediaLookup } from "../../utils/medialookup";
import type { ReactResult } from "../../utils/types";
import { PageType } from "../types";
import MediaDisplay from "./MediaDisplay";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    content: {
      flexGrow: 1,
      position: "relative",
      background: theme.palette.background.default,
    },
  }));

export interface MediaFinderProps {
  readonly media: string;
  readonly lookup: MediaLookup | null;
}

export default function MediaFinder({ media, lookup }: MediaFinderProps): ReactResult {
  let actions = useActions();
  let classes = useStyles();

  let mediaList = useMediaLookup(useMemo<MediaLookup>(() => {
    return lookup ?? {
      type: MediaLookupType.Single,
      media: media,
    };
  }, [lookup, media]));

  let mediaIndex = useMemo(
    () => mediaList?.findIndex((item: MediaState): boolean => item.id == media) ?? -1,
    [media, mediaList],
  );

  let parent = useMemo<UIState | null>(() => {
    switch (lookup?.type) {
      case MediaLookupType.Album:
        return {
          page: {
            type: PageType.Album,
            album: lookup.album,
          },
        };
      case MediaLookupType.Catalog:
        return {
          page: {
            type: PageType.Catalog,
            catalog: lookup.catalog,
          },
        };
    }

    return null;
  }, [lookup]);

  let onGoBack = useMemo<(() => void) | null>(() => {
    if (!parent) {
      return null;
    }

    let to = parent;
    return () => actions.navigate(to);
  }, [actions, parent]);

  let onPrevious = useMemo(() => {
    if (mediaIndex <= 0 || !mediaList) {
      return null;
    }

    let previous = mediaList[mediaIndex - 1].id;

    return () => {
      actions.navigate({
        page: {
          type: PageType.Media,
          media: previous,
          lookup: lookup,
        },
      });
    };
  }, [mediaIndex, mediaList, actions, lookup]);

  let onNext = useMemo(() => {
    if (!mediaList || mediaIndex == mediaList.length - 1 || mediaIndex < 0) {
      return null;
    }

    let next = mediaList[mediaIndex + 1].id;

    return () => {
      actions.navigate({
        page: {
          type: PageType.Media,
          media: next,
          lookup: lookup,
        },
      });
    };
  }, [mediaIndex, mediaList, actions, lookup]);

  if (!mediaList) {
    return <Page sidebar="openable">
      <Loading className={classes.content}/>
    </Page>;
  }

  if (mediaIndex < 0) {
    // TODO add an error component.
    return <Page sidebar="openable">
      <Loading className={classes.content}/>
    </Page>;
  }

  let foundMedia = mediaList[mediaIndex];

  if (!isProcessedMedia(foundMedia)) {
    return <Page sidebar="openable">
      <Loading className={classes.content}/>
    </Page>;
  }

  return <Page sidebar="openable">
    <MediaDisplay
      media={foundMedia}
      onNext={onNext}
      onGoBack={onGoBack}
      onPrevious={onPrevious}
    />
  </Page>;
}
