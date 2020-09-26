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
import { document } from "../environment";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { MediaLookup, MediaLookupType, StoreState } from "../store/types";
import Delayed from "../utils/delayed";
import { useFullscreen } from "../utils/hooks";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps, PageType } from "./types";

const overlayBackground = "rgba(0, 0, 0, 0.6)";
const overlayIcon = "rgb(150, 150, 150)";

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
      background: "black",
    },
    overlay: {
      position: "absolute",
      height: "100%",
      width: "100%",
    },
  }));

const useOverlayStyles = makeStyles((theme: Theme) =>
  createStyles({
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
      paddingRight: theme.spacing(1),
      paddingLeft: theme.spacing(1),
    },
    overlayTop: {
      background: overlayBackground,
      padding: theme.spacing(2),
    },
    navButton: {
      "fontSize": "4rem",
      "color": overlayIcon,
      "background": overlayBackground,
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
    overlayButton: {
      "fontSize": "2rem",
      "color": overlayIcon,
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
  }));

const useMediaStyles = makeStyles(() =>
  createStyles({
    media: (media: ProcessedMediaState) => ({
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
  onGoFullscreen?: () => void;
  onExitFullscreen?: () => void;
}

function Photo(props: ProcessedMediaProps): ReactResult {
  const classes = useMediaStyles(props.media);

  return <img
    key={props.media.id}
    src={props.media.originalUrl}
    className={classes.media}
  />;
}

function Video(props: ProcessedMediaProps): ReactResult {
  const classes = useMediaStyles(props.media);

  return <video
    key={props.media.id}
    poster={props.media.posterUrl ?? undefined}
    controls={true}
    className={classes.media}
  >
    <source src={props.media.originalUrl} type={props.media.mimetype}/>
  </video>;
}

function MediaOverlay(props: MediaOverlayProps): ReactResult {
  const classes = useOverlayStyles();
  const fullscreen = useFullscreen();

  return <div className={classes.overlayContent}>
    <div className={classes.overlayTop}>
      {
        fullscreen
          ? <IconButton onClick={props.onExitFullscreen} className={classes.overlayButton}>
            <FullscreenExitIcon/>
          </IconButton>
          : <IconButton onClick={props.onGoFullscreen} className={classes.overlayButton}>
            <FullscreenIcon/>
          </IconButton>
      }
    </div>
    <div className={classes.overlayMiddle}>
      <div>
        {
          props.onPrevious && <IconButton
            onClick={props.onPrevious}
            className={classes.navButton}
          >
            <NavigateBeforeIcon/>
          </IconButton>
        }
      </div>
      <div>
        {
          props.onNext && <IconButton
            onClick={props.onNext}
            className={classes.navButton}
          >
            <NavigateNextIcon/>
          </IconButton>
        }
      </div>
    </div>
  </div>;
}

export default function MediaPage(props: MediaPageProps & AuthenticatedPageProps): ReactResult {
  const actions = useActions();
  const classes = useMainStyles();
  const areaRef = useRef<HTMLDivElement>(null);

  const mediaList = useSelector((state: StoreState) => state.mediaList?.media);

  const [displayOverlays, setDisplayOverlays] = useState(false);

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

  const hideOverlays = useCallback(() => {
    setDisplayOverlays(false);
  }, []);

  const delayed = useMemo(() => new Delayed(1500, hideOverlays), [hideOverlays]);

  const showOverlays = useCallback(() => {
    setDisplayOverlays(true);
    delayed.trigger();
  }, [delayed]);

  const goFullscreen = useCallback(() => {
    void areaRef.current?.requestFullscreen();
  }, [areaRef]);

  const exitFullscreen = useCallback(() => {
    void document.exitFullscreen();
  }, []);

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
    <div
      className={classes.content}
      ref={areaRef}
      onMouseOver={showOverlays}
      onMouseMove={showOverlays}
    >
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
      <Fade in={displayOverlays} timeout={500}>
        <div className={classes.overlay}>
          <MediaOverlay
            media={media}
            onPrevious={onPrevious}
            onNext={onNext}
            onGoFullscreen={goFullscreen}
            onExitFullscreen={exitFullscreen}
          />
        </div>
      </Fade>
    </div>
  </Page>;
}
