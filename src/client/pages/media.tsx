import Box from "@material-ui/core/Box";
import Fade from "@material-ui/core/Fade";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import {
  createMuiTheme,
  createStyles,
  makeStyles,
  Theme,
  ThemeProvider,
} from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import CloseIcon from "@material-ui/icons/Close";
import FullscreenIcon from "@material-ui/icons/Fullscreen";
import FullscreenExitIcon from "@material-ui/icons/FullscreenExit";
import InfoIcon from "@material-ui/icons/Info";
import NavigateBeforeIcon from "@material-ui/icons/NavigateBefore";
import NavigateNextIcon from "@material-ui/icons/NavigateNext";
import alpha from "color-alpha";
import React, { useCallback, useMemo, useRef, useState } from "react";

import { ObjectModel } from "../../model";
import { isProcessed, MediaState } from "../api/types";
import FixedAspect from "../components/FixedAspect";
import Loading from "../components/Loading";
import { Photo, Video } from "../components/Media";
import MediaInfo from "../components/MediaInfo";
import Page from "../components/Page";
import { document } from "../environment";
import { useActions } from "../store/actions";
import { UIState } from "../store/types";
import Delayed from "../utils/delayed";
import { useFullscreen } from "../utils/hooks";
import { MediaLookup, MediaLookupType, useMediaLookup } from "../utils/medialookup";
import { mediaTitle } from "../utils/metadata";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps, PageType } from "./types";

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

const theme = createMuiTheme({
  palette: {
    type: "dark",
  },
});

export interface MediaPageProps {
  readonly media: string;
  readonly lookup: MediaLookup | null;
}

function MediaPage(props: MediaPageProps & AuthenticatedPageProps): ReactResult {
  const actions = useActions();
  const classes = useStyles();
  const areaRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen();

  const [displayOverlays, setDisplayOverlays] = useState(true);
  const [showMediaInfo, setShowMediaInfo] = useState(false);
  const [location, setLocation] = useState<ObjectModel.Location | null>(null);

  const onShowInfo = useCallback(() => setShowMediaInfo(true), []);
  const onCloseInfo = useCallback(() => setShowMediaInfo(false), []);

  const parent = useMemo<UIState | null>(() => {
    switch (props.lookup?.type) {
      case MediaLookupType.Album:
        return {
          page: {
            type: PageType.Album,
            album: props.lookup.album,
          },
        };
      case MediaLookupType.Catalog:
        return {
          page: {
            type: PageType.Catalog,
            catalog: props.lookup.catalog,
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

  let lookup = useMemo<MediaLookup>(() => {
    return props.lookup ?? {
      type: MediaLookupType.Single,
      media: props.media,
    };
  }, [props.lookup, props.media]);

  let mediaList = useMediaLookup(lookup);

  const mediaIndex = useMemo(
    () => mediaList?.findIndex((item: MediaState): boolean => item.id == props.media) ?? -1,
    [props.media, mediaList],
  );

  const onPrevious = useMemo(() => {
    if (mediaIndex == 0 || !mediaList) {
      return null;
    }

    let previous = mediaList[mediaIndex - 1].id;

    return () => {
      actions.navigate({
        page: {
          type: PageType.Media,
          media: previous,
          lookup: props.lookup,
        },
      });
    };
  }, [mediaIndex, mediaList, actions, props.lookup]);

  const onNext = useMemo(() => {
    if (!mediaList || mediaIndex == mediaList.length - 1) {
      return null;
    }

    let next = mediaList[mediaIndex + 1].id;

    return () => {
      actions.navigate({
        page: {
          type: PageType.Media,
          media: next,
          lookup: props.lookup,
        },
      });
    };
  }, [mediaIndex, mediaList, actions, props.lookup]);

  const hideOverlays = useCallback(() => {
    setDisplayOverlays(false);
  }, []);

  const delayed = useMemo(() => new Delayed(1500, hideOverlays), [hideOverlays]);
  delayed.trigger();

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
  const title = mediaTitle(media);

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
            {
              location &&
              <div
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
        <div className={classes.overlay}>
          <MainOverlay
            media={media}
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
        <MediaInfo media={media} onHighlightRegion={setLocation}/>
      </Paper>
    }
  </Page>;
}

export default function DarkMediaPage(props: MediaPageProps & AuthenticatedPageProps): ReactResult {
  return <ThemeProvider theme={theme}>
    <MediaPage {...props}/>
  </ThemeProvider>;
}