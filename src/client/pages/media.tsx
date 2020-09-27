import Fade from "@material-ui/core/Fade";
import IconButton from "@material-ui/core/IconButton";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import CloseIcon from "@material-ui/icons/Close";
import FullscreenIcon from "@material-ui/icons/Fullscreen";
import FullscreenExitIcon from "@material-ui/icons/FullscreenExit";
import InfoIcon from "@material-ui/icons/Info";
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
import { MediaLookup, MediaLookupType, StoreState, UIState } from "../store/types";
import Delayed from "../utils/delayed";
import { useFullscreen } from "../utils/hooks";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps, PageType } from "./types";

const overlayBackground = "rgba(0, 0, 0, 0.6)";
const overlayIcon = "rgb(150, 150, 150)";
const overlayIconHover = "white";

const useStyles = makeStyles((theme: Theme) =>
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
    viewport: {
      position: "relative",
    },
    overlay: {
      position: "absolute",
      height: "100%",
      width: "100%",
      pointerEvents: "none",
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
      paddingRight: theme.spacing(1),
      paddingLeft: theme.spacing(1),
    },
    overlayTop: {
      background: overlayBackground,
      padding: theme.spacing(2),
      pointerEvents: "auto",
      display: "flex",
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    navButton: {
      "fontSize": "4rem",
      "color": overlayIcon,
      "background": overlayBackground,
      "pointerEvents": "auto",
      "&:hover": {
        color: overlayIconHover,
      },
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
    overlayButton: {
      "fontSize": "2rem",
      "color": overlayIcon,
      "&:hover": {
        color: overlayIconHover,
      },
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
    media: {
      position: "absolute",
      height: "100%",
      width: "100%",
      objectPosition: "center center",
      objectFit: "contain",
    },
    mediaControls: {
      position: "absolute",
      bottom: 0,
      right: 0,
      left: 0,
      padding: theme.spacing(1),
      background: overlayBackground,
      display: "flex",
      flexDirection: "row",
    },
  }));

interface MediaDisplayProps {
  media: ProcessedMediaState;
  displayOverlays: boolean;
  children?: React.ReactNode;
}

function Photo(props: MediaDisplayProps): ReactResult {
  const classes = useStyles();

  return <React.Fragment>
    <img
      key={props.media.id}
      src={props.media.originalUrl}
      className={classes.media}
    />
    <Fade in={props.displayOverlays} timeout={500}>
      <div className={classes.mediaControls}>
        {props.children}
      </div>
    </Fade>
  </React.Fragment>;
}

function Video(props: MediaDisplayProps): ReactResult {
  const classes = useStyles();

  return <React.Fragment>
    <video
      key={props.media.id}
      poster={props.media.posterUrl ?? undefined}
      controls={false}
      className={classes.media}
    >
      <source src={props.media.originalUrl} type={props.media.mimetype}/>
    </video>
    <Fade in={props.displayOverlays} timeout={500}>
      <div className={classes.mediaControls}>
        {props.children}
      </div>
    </Fade>
  </React.Fragment>;
}

interface MainOverlayProps {
  media: MediaState;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  onGoBack?: (() => void) | null;
  onShowInfo?: (() => void) | null;
}

function MainOverlay(props: MainOverlayProps): ReactResult {
  const classes = useStyles();

  return <div className={classes.overlayContent}>
    <div className={classes.overlayTop}>
      {
        props.onShowInfo && <IconButton
          onClick={props.onShowInfo}
          className={classes.overlayButton}
        >
          <InfoIcon/>
        </IconButton>
      }
      {
        props.onGoBack && <IconButton
          onClick={props.onGoBack}
          className={classes.overlayButton}
        >
          <CloseIcon/>
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

export interface MediaPageProps {
  readonly media: string;
  readonly lookup: MediaLookup | null;
}

export default function MediaPage(props: MediaPageProps & AuthenticatedPageProps): ReactResult {
  const actions = useActions();
  const classes = useStyles();
  const areaRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen();

  const mediaList = useSelector((state: StoreState) => state.mediaList?.media);

  const [displayOverlays, setDisplayOverlays] = useState(false);

  const parent = useMemo<UIState | null>(() => {
    switch (props.lookup?.type) {
      case MediaLookupType.Album:
        return {
          page: {
            type: PageType.Album,
            album: props.lookup.album,
          },
        };
    }

    return null;
  }, [props.lookup]);

  const goBack = useMemo<(() => void) | null>(() => {
    if (!parent) {
      return null;
    }

    return () => actions.navigate(parent);
  }, [actions, parent]);

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

  const mediaControls = fullscreen
    ? <IconButton onClick={exitFullscreen} className={classes.overlayButton}>
      <FullscreenExitIcon/>
    </IconButton>
    : <IconButton onClick={goFullscreen} className={classes.overlayButton}>
      <FullscreenIcon/>
    </IconButton>;

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
                viewport: classes.viewport,
              }
            }
          >
            {
              media.mimetype.startsWith("video/")
                ? <Video media={media} displayOverlays={displayOverlays}>
                  {mediaControls}
                </Video>
                : <Photo media={media} displayOverlays={displayOverlays}>
                  {mediaControls}
                </Photo>
            }
          </FixedAspect>
          : <Loading className={classes.mediaArea}/>
      }
      <Fade in={displayOverlays} timeout={500}>
        <div className={classes.overlay}>
          <MainOverlay
            media={media}
            onPrevious={onPrevious}
            onNext={onNext}
            onGoBack={goBack}
          />
        </div>
      </Fade>
    </div>
  </Page>;
}
