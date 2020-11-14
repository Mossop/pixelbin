import Box from "@material-ui/core/Box";
import Fade from "@material-ui/core/Fade";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import type { Theme } from "@material-ui/core/styles";
import {
  createMuiTheme,
  createStyles,
  makeStyles,
  ThemeProvider,
} from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import clsx from "clsx";
import alpha from "color-alpha";
import React, { useCallback, useMemo, useRef, useState } from "react";

import type { ObjectModel } from "../../model";
import type { MediaState } from "../api/types";
import { isProcessedMedia } from "../api/types";
import FixedAspect from "../components/FixedAspect";
import Loading from "../components/Loading";
import { Photo, Video } from "../components/Media";
import MediaInfo from "../components/MediaInfo";
import Page from "../components/Page";
import { document } from "../environment";
import CloseIcon from "../icons/CloseIcon";
import EnterFullscreenIcon from "../icons/EnterFullscreenIcon";
import ExitFullscreenIcon from "../icons/ExitFullscreenIcon";
import InfoIcon from "../icons/InfoIcon";
import NextIcon from "../icons/NextIcon";
import PreviousIcon from "../icons/PreviousIcon";
import { useActions } from "../store/actions";
import type { UIState } from "../store/types";
import Delayed from "../utils/delayed";
import { useFullscreen } from "../utils/hooks";
import type { MediaLookup } from "../utils/medialookup";
import { MediaLookupType, useMediaLookup } from "../utils/medialookup";
import { mediaTitle } from "../utils/metadata";
import type { ReactResult } from "../utils/types";
import type { AuthenticatedPageProps } from "./types";
import { PageType } from "./types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    content: {
      flexGrow: 1,
      position: "relative",
      background: theme.palette.background.default,
    },
    mediaArea: {
      position: "absolute",
      height: "100%",
      width: "100%",
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
      background: alpha(theme.palette.background.paper, 0.6),
      padding: theme.spacing(2),
      pointerEvents: "auto",
      display: "flex",
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    navButton: {
      "fontSize": "4rem",
      "background": alpha(theme.palette.background.paper, 0.6),
      "pointerEvents": "auto",
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
    overlayButton: {
      "fontSize": "2rem",
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
    face: {
      position: "absolute",
      borderWidth: 2,
      borderStyle: "solid",
      borderColor: theme.palette.primary.dark,
    },
    infoTitlebar: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "start",
      padding: theme.spacing(1),
    },
    infoTitle: {
      flex: 1,
      padding: theme.spacing(1),
    },
  }));

interface MainOverlayProps {
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  onGoBack?: (() => void) | null;
  onShowInfo?: (() => void) | null;
}

function MainOverlay({
  onNext,
  onPrevious,
  onGoBack,
  onShowInfo,
}: MainOverlayProps): ReactResult {
  let classes = useStyles();

  return <div id="main-overlay" className={classes.overlayContent}>
    <div className={classes.overlayTop}>
      {
        onShowInfo && <IconButton
          id="info-button"
          onClick={onShowInfo}
          className={classes.overlayButton}
        >
          <InfoIcon/>
        </IconButton>
      }
      {
        onGoBack && <IconButton
          id="back-button"
          onClick={onGoBack}
          className={classes.overlayButton}
        >
          <CloseIcon/>
        </IconButton>
      }
    </div>
    <div className={classes.overlayMiddle}>
      <div>
        {
          onPrevious && <IconButton
            id="prev-button"
            onClick={onPrevious}
            className={classes.navButton}
          >
            <PreviousIcon/>
          </IconButton>
        }
      </div>
      <div>
        {
          onNext && <IconButton
            id="next-button"
            onClick={onNext}
            className={classes.navButton}
          >
            <NextIcon/>
          </IconButton>
        }
      </div>
    </div>
  </div>;
}

const theme = createMuiTheme({
  palette: {
    type: "dark",
  },
});

export interface MediaPageProps {
  readonly media: string;
  readonly lookup: MediaLookup | null;
}

function MediaPage({ media, lookup }: MediaPageProps & AuthenticatedPageProps): ReactResult {
  let actions = useActions();
  let classes = useStyles();
  let areaRef = useRef<HTMLDivElement>(null);
  let fullscreen = useFullscreen();

  let [displayOverlays, setDisplayOverlays] = useState(true);
  let [showMediaInfo, setShowMediaInfo] = useState(false);
  let [location, setLocation] = useState<ObjectModel.Location | null>(null);

  let onShowInfo = useCallback(() => setShowMediaInfo(true), []);
  let onCloseInfo = useCallback(() => setShowMediaInfo(false), []);

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

  let goBack = useMemo<(() => void) | null>(() => {
    if (!parent) {
      return null;
    }

    let to = parent;
    return () => actions.navigate(to);
  }, [actions, parent]);

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

  let hideOverlays = useCallback(() => {
    setDisplayOverlays(false);
  }, []);

  let delayed = useMemo(() => {
    let delayed = new Delayed(1500, hideOverlays);
    delayed.trigger();
    return delayed;
  }, [hideOverlays]);

  let showOverlays = useCallback(() => {
    setDisplayOverlays(true);
    delayed.trigger();
  }, [delayed]);

  let goFullscreen = useCallback(() => {
    void areaRef.current?.requestFullscreen();
  }, [areaRef]);

  let exitFullscreen = useCallback(() => {
    void document.exitFullscreen();
  }, []);

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

  let mediaState = mediaList[mediaIndex];
  let title = mediaTitle(mediaState);

  let mediaControls = fullscreen
    ? <IconButton id="exit-fullscreen" onClick={exitFullscreen} className={classes.overlayButton}>
      <ExitFullscreenIcon/>
    </IconButton>
    : <IconButton id="enter-fullscreen" onClick={goFullscreen} className={classes.overlayButton}>
      <EnterFullscreenIcon/>
    </IconButton>;

  return <Page sidebar="openable">
    <div
      id="media-display"
      className={classes.content}
      ref={areaRef}
      onMouseOver={showOverlays}
      onMouseMove={showOverlays}
    >
      {
        isProcessedMedia(mediaState)
          ? <FixedAspect
            width={mediaState.file.width}
            height={mediaState.file.height}
            classes={
              {
                root: classes.mediaArea,
                viewport: classes.viewport,
              }
            }
          >
            {
              mediaState.file.mimetype.startsWith("video/")
                ? <Video media={mediaState} displayOverlays={displayOverlays}>
                  {mediaControls}
                </Video>
                : <Photo media={mediaState} displayOverlays={displayOverlays}>
                  {mediaControls}
                </Photo>
            }
            {
              location &&
              <div
                id="person-area"
                className={classes.face}
                style={
                  {
                    left: `${location.left * 100}%`,
                    top: `${location.top * 100}%`,
                    right: `${100 - location.right * 100}%`,
                    bottom: `${100 - location.bottom * 100}%`,
                  }
                }
              />
            }
          </FixedAspect>
          : <Loading className={classes.mediaArea}/>
      }
      <Fade in={displayOverlays} timeout={500}>
        <div className={clsx(classes.overlay, displayOverlays ? "visible" : "hidden")}>
          <MainOverlay
            onPrevious={onPrevious}
            onNext={onNext}
            onGoBack={goBack}
            onShowInfo={onShowInfo}
          />
        </div>
      </Fade>
    </div>
    {
      showMediaInfo &&
      <Paper square={true}>
        <Box className={classes.infoTitlebar}>
          {
            title &&
            <Typography variant="h4" className={classes.infoTitle}>{title}</Typography>
          }
          <IconButton onClick={onCloseInfo}><CloseIcon/></IconButton>
        </Box>
        <MediaInfo media={mediaState} onHighlightRegion={setLocation}/>
      </Paper>
    }
  </Page>;
}

export default function DarkMediaPage(props: MediaPageProps & AuthenticatedPageProps): ReactResult {
  return <ThemeProvider theme={theme}>
    <MediaPage {...props}/>
  </ThemeProvider>;
}
