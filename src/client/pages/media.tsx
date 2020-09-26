import Box from "@material-ui/core/Box";
import Fade from "@material-ui/core/Fade";
import IconButton from "@material-ui/core/IconButton";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import FullscreenIcon from "@material-ui/icons/Fullscreen";
import FullscreenExitIcon from "@material-ui/icons/FullscreenExit";
import NavigateBeforeIcon from "@material-ui/icons/NavigateBefore";
import NavigateNextIcon from "@material-ui/icons/NavigateNext";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isProcessed, MediaState, ProcessedMediaState } from "../api/types";
import FixedAspect from "../components/FixedAspect";
import Loading from "../components/Loading";
import Page from "../components/Page";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { MediaLookup, MediaLookupType, StoreState } from "../store/types";
import Delayed from "../utils/delayed";
import { useFullscreen } from "../utils/hooks";
import { ReactResult } from "../utils/types";
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

const useOverlayStyles = makeStyles((theme: Theme) =>
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
      padding: theme.spacing(2),
    },
    overlayBottom: {
      background: "rgba(0, 0, 0, 0.5)",
      padding: theme.spacing(2),
    },
    navButton: {
      fontSize: "300%",
    },
    overlayButton: {
      fontSize: "150%",
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

  return <video
    poster={props.media.posterUrl ?? undefined}
    controls={true}
    className={classes.photo}
  >
    <source src={props.media.originalUrl} type={props.media.mimetype}/>
  </video>;
}

function MediaOverlay(props: MediaOverlayProps): ReactResult {
  const classes = useOverlayStyles();
  const areaRef = useRef<HTMLDivElement>(null);
  const [displayOverlays, setDisplayOverlays] = useState(false);
  const fullscreen = useFullscreen();

  const goFullscreen = useCallback(() => {
    if (!areaRef.current) {
      return;
    }

    void areaRef.current.parentElement?.requestFullscreen();
  }, [areaRef]);

  const exitFullscreen = useCallback(() => {
    if (!areaRef.current) {
      return;
    }

    void areaRef.current.ownerDocument.exitFullscreen();
  }, [areaRef]);

  const hideOverlays = useCallback(() => {
    console.log("hideOverlays");
    setDisplayOverlays(false);
  }, []);

  const delayed = useMemo(() => new Delayed(1000, hideOverlays), [hideOverlays]);

  const showOverlays = useCallback(() => {
    console.log("showOverlays");
    setDisplayOverlays(true);
    delayed.trigger();
  }, [delayed]);

  return <div
    ref={areaRef}
    className={classes.overlay}
    onMouseOver={showOverlays}
    onMouseMove={showOverlays}
  >
    <Fade in={displayOverlays}>
      <div className={classes.overlayContent}>
        <div className={classes.overlayTop}>
          {
            fullscreen
              ? <IconButton onClick={exitFullscreen}>
                <FullscreenExitIcon className={classes.overlayButton}/>
              </IconButton>
              : <IconButton onClick={goFullscreen}>
                <FullscreenIcon className={classes.overlayButton}/>
              </IconButton>
          }
        </div>
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
