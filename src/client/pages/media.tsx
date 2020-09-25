import Box from "@material-ui/core/Box";
import Fade from "@material-ui/core/Fade";
import IconButton from "@material-ui/core/IconButton";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import NavigateBeforeIcon from "@material-ui/icons/NavigateBefore";
import NavigateNextIcon from "@material-ui/icons/NavigateNext";
import React, { useEffect, useMemo, useRef } from "react";

import { isProcessed, MediaState, ProcessedMediaState } from "../api/types";
import FixedAspect from "../components/FixedAspect";
import Loading from "../components/Loading";
import Page from "../components/Page";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { MediaLookup, MediaLookupType, StoreState } from "../store/types";
import { ReactResult } from "../utils/types";
import useMouseMove from "../utils/useMouseMove";
import { AuthenticatedPageProps, PageType } from "./types";

const useMainStyles = makeStyles(() =>
  createStyles({
    content: {
      flexGrow: 1,
      position: "relative",
    },
    mediaArea: {
      position: "absolute",
      height: "100%",
      width: "100%",
    },
  }));

const useOverlayStyles = makeStyles(() =>
  createStyles({
    overlay: {
      position: "absolute",
      height: "100%",
      width: "100%",
    },
    overlayContent: {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
    },
    overlayMiddle: {
      flexGrow: 1,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    overlayTop: {
      background: "rgba(0, 0, 0, 0.5)",
    },
    overlayBottom: {
      background: "rgba(0, 0, 0, 0.5)",
    },
    navButton: {
      fontSize: "300%",
    },
  }));

const useMediaStyles = makeStyles(() =>
  createStyles({
    photo: (media: ProcessedMediaState) => ({
      objectPosition: "center center",
      objectFit: "scale-down",
      height: "100%",
      width: "100%",
      maxHeight: media.height,
      maxWidth: media.width,
    }),
  }));

export interface MediaPageProps {
  readonly media: string;
  readonly lookup: MediaLookup | null;
}

interface ProcessedMediaProps {
  media: ProcessedMediaState;
}

interface MediaOverlayProps {
  media: MediaState;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
}

function Photo(props: ProcessedMediaProps): ReactResult {
  const classes = useMediaStyles(props.media);

  return <img src={props.media.originalUrl} className={classes.photo}/>;
}

function Video(props: ProcessedMediaProps): ReactResult {
  const classes = useMediaStyles(props.media);

  return <video src={props.media.originalUrl} controls={true} className={classes.photo}/>;
}

function MediaOverlay(props: MediaOverlayProps): ReactResult {
  const classes = useOverlayStyles();
  const areaRef = useRef<HTMLDivElement>(null);

  let displayOverlays = useMouseMove(areaRef);

  return <div ref={areaRef} className={classes.overlay}>
    <Fade in={displayOverlays}>
      <div className={classes.overlayContent}>
        <div className={classes.overlayTop}/>
        <div className={classes.overlayMiddle}>
          <div>
            {
              props.onPrevious && <IconButton onClick={props.onPrevious}>
                <NavigateBeforeIcon className={classes.navButton}/>
              </IconButton>
            }
          </div>
          <div>
            {
              props.onNext && <IconButton onClick={props.onNext}>
                <NavigateNextIcon className={classes.navButton}/>
              </IconButton>
            }
          </div>
        </div>
        <div className={classes.overlayBottom}/>
      </div>
    </Fade>
  </div>;
}

export default function MediaPage(props: MediaPageProps & AuthenticatedPageProps): ReactResult {
  const actions = useActions();
  const classes = useMainStyles();

  const mediaList = useSelector((state: StoreState) => state.mediaList?.media);

  useEffect(
    () => {
      actions.listMedia(props.lookup ?? {
        type: MediaLookupType.Single,
        media: props.media,
      });
    },
    [props.lookup, props.media, actions],
  );

  const mediaIndex = useMemo(
    () => mediaList?.findIndex((item: MediaState): boolean => item.id == props.media) ?? -1,
    [props.media, mediaList],
  );

  const onPrevious = useMemo(() => {
    if (mediaIndex == 0 || !mediaList) {
      return null;
    }

    return () => {
      actions.navigate({
        page: {
          type: PageType.Media,
          media: mediaList[mediaIndex - 1].id,
          lookup: props.lookup,
        },
      });
    };
  }, [mediaIndex, mediaList, actions, props.lookup]);

  const onNext = useMemo(() => {
    if (!mediaList || mediaIndex == mediaList.length - 1) {
      return null;
    }

    return () => {
      actions.navigate({
        page: {
          type: PageType.Media,
          media: mediaList[mediaIndex + 1].id,
          lookup: props.lookup,
        },
      });
    };
  }, [mediaIndex, mediaList, actions, props.lookup]);

  if (!mediaList) {
    return <Page>
      <Loading flexGrow={1}/>
    </Page>;
  }

  if (mediaIndex < 0) {
    return <Page>
      <Loading flexGrow={1}/>
    </Page>;
  }

  const media = mediaList[mediaIndex];

  return <Page sidebar="openable">
    <Box className={classes.content}>
      {
        isProcessed(media)
          ? <FixedAspect
            width={media.width}
            height={media.height}
            classes={
              {
                root: classes.mediaArea,
              }
            }
          >
            {
              media.mimetype.startsWith("video/")
                ? <Video media={media}/>
                : <Photo media={media}/>
            }
          </FixedAspect>
          : <Loading className={classes.mediaArea}/>
      }
      <MediaOverlay
        media={media}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </Box>
  </Page>;
}
