import Dialog from "@material-ui/core/Dialog";
import Drawer from "@material-ui/core/Drawer";
import Fade from "@material-ui/core/Fade";
import IconButton from "@material-ui/core/IconButton";
import Slide from "@material-ui/core/Slide";
import type { Theme } from "@material-ui/core/styles";
import { useTheme, createStyles, makeStyles } from "@material-ui/core/styles";
import type { TransitionProps } from "@material-ui/core/transitions";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Person, Reference } from "../../api/highlevel";
import { getMediaRelations } from "../../api/media";
import type { BaseMediaState, MediaRelations } from "../../api/types";
import { isProcessed } from "../../api/types";
import CloseIcon from "../../icons/CloseIcon";
import DownloadIcon from "../../icons/DownloadIcon";
import EnterFullscreenIcon from "../../icons/EnterFullscreenIcon";
import ExitFullscreenIcon from "../../icons/ExitFullscreenIcon";
import InfoIcon from "../../icons/InfoIcon";
import { useFullscreen, usePromise } from "../../utils/hooks";
import { mediaTitle } from "../../utils/metadata";
import type { ReactChildren, ReactResult } from "../../utils/types";
import { HoverContainer } from "../HoverArea";
import Loading from "../Loading";
import FaceHighlight from "./FaceHighlight";
import MediaInfo from "./MediaInfo";
import MediaNavigation from "./MediaNavigation";
import { Photo } from "./Photo";
import { Video } from "./Video";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      height: "100%",
      width: "100%",
      position: "relative",
      background: theme.palette.background.default,
      display: "flex",
      alignItems: "stretch",
      justifyContent: "stretch",
      zIndex: 1,
    },
    loading: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    media: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    closeButton: {
      position: "sticky",
      alignSelf: "end",
      top: 0,
    },
    overlayButton: {
      "marginRight": theme.spacing(1),
      "fontSize": "2rem",
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
  }));

const Transition = forwardRef(function Transition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: TransitionProps & { children?: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="left" ref={ref} {...props}/>;
});

interface InfoAreaProps {
  open: boolean;
  onClose: () => void;
}

function InfoArea({
  open,
  onClose,
  children,
}: InfoAreaProps & ReactChildren): ReactResult {
  let classes = useStyles();
  let theme = useTheme();
  let infoModal = useMediaQuery(theme.breakpoints.down("xs"));

  if (infoModal) {
    return <Dialog
      open={open}
      fullScreen={true}
      TransitionComponent={Transition}
    >
      <IconButton
        aria-label="close"
        id="sidebar-close"
        className={classes.closeButton}
        onClick={onClose}
      >
        <CloseIcon/>
      </IconButton>
      {children}
    </Dialog>;
  } else {
    return <Drawer anchor="right" open={open} onClose={onClose}>
      {children}
    </Drawer>;
  }
}

export interface MediaDisplayProps<T extends BaseMediaState> {
  galleryTitle: string;
  media: readonly T[] | null;
  selectedMedia: string;
  onChangeMedia: (media: T) => void;
  onCloseMedia: () => void;
}

export default function MediaDisplay<T extends BaseMediaState>({
  galleryTitle,
  media,
  selectedMedia,
  onChangeMedia,
  onCloseMedia,
}: MediaDisplayProps<T>): ReactResult {
  let classes = useStyles();
  let mediaIndex = useMemo(() => {
    if (!media) {
      return -1;
    }

    return media.findIndex((media: T): boolean => media.id == selectedMedia);
  }, [media, selectedMedia]);

  let [loaded, setLoaded] = useState(false);
  let onLoad = useCallback(() => setLoaded(true), []);

  let onPrevious = useMemo(() => {
    if (mediaIndex <= 0 || !media) {
      return null;
    }
    setLoaded(false);
    return () => onChangeMedia(media[mediaIndex - 1]);
  }, [media, onChangeMedia, mediaIndex]);

  let onNext = useMemo(() => {
    if (mediaIndex < 0 || !media || mediaIndex >= media.length - 1) {
      return null;
    }
    setLoaded(false);
    return () => onChangeMedia(media[mediaIndex + 1]);
  }, [media, onChangeMedia, mediaIndex]);

  let areaRef = useRef<HTMLDivElement>(null);
  let fullscreen = useFullscreen();

  let [showMediaInfo, setShowMediaInfo] = useState(false);
  let [personHighlight, setPersonHighlight] = useState<Reference<Person> | null>(null);

  let onShowInfo = useCallback(() => setShowMediaInfo(!showMediaInfo), [showMediaInfo]);
  let onCloseInfo = useCallback(() => setShowMediaInfo(false), []);

  let goFullscreen = useCallback(() => {
    void areaRef.current?.requestFullscreen();
  }, [areaRef]);

  let exitFullscreen = useCallback(() => {
    void document.exitFullscreen();
  }, []);

  let relations = usePromise(useMemo(() => {
    if (mediaIndex < 0 || !media) {
      return Promise.resolve(null);
    }

    return getMediaRelations([media[mediaIndex].id]).then(
      (results: (MediaRelations | null)[]): MediaRelations | null => results[0],
      (error: Error) => {
        console.error(error);
        return null;
      },
    );
  }, [media, mediaIndex]));

  let mediaToShow = media?.[mediaIndex];

  useEffect(() => {
    let base = mediaToShow ? mediaTitle(mediaToShow) : null;
    document.title = base ? `${base} - ${galleryTitle}` : galleryTitle;
  }, [mediaToShow, galleryTitle]);

  let mediaControls = <>
    {
      mediaToShow && isProcessed(mediaToShow) &&
      <IconButton
        id="download-button"
        component="a"
        className={classes.overlayButton}
        href={mediaToShow.file.url}
        download={true}
      >
        <DownloadIcon/>
      </IconButton>
    }
    {
      fullscreen
        ? <IconButton
          id="exit-fullscreen"
          onClick={exitFullscreen}
          className={classes.overlayButton}
        >
          <ExitFullscreenIcon/>
        </IconButton>
        : <IconButton
          id="enter-fullscreen"
          onClick={goFullscreen}
          className={classes.overlayButton}
        >
          <EnterFullscreenIcon/>
        </IconButton>
    }
    <IconButton
      id="info-button"
      onClick={onShowInfo}
      className={classes.overlayButton}
    >
      <InfoIcon/>
    </IconButton>
  </>;

  let content: React.ReactElement | undefined = undefined;
  if (mediaToShow && isProcessed(mediaToShow)) {
    if (mediaToShow.file.mimetype.startsWith("video/")) {
      content = <Video mediaFile={mediaToShow.file} key={mediaToShow.id} onLoad={onLoad}>
        {mediaControls}
      </Video>;
    } else {
      content = <Photo mediaFile={mediaToShow.file} key={mediaToShow.id} onLoad={onLoad}>
        {mediaControls}
      </Photo>;
    }
  }

  return <HoverContainer
    id="media-display"
    className={classes.root}
    ref={areaRef}
  >
    {
      !loaded &&
      <Loading className={classes.loading}/>
    }
    <Fade in={loaded} timeout={500}>
      <div className={classes.media}>
        {content}
      </div>
    </Fade>
    {
      personHighlight && mediaToShow && isProcessed(mediaToShow) &&
      <FaceHighlight
        mediaFile={mediaToShow.file}
        relations={relations}
        people={[personHighlight]}
      />
    }
    {
      mediaToShow &&
      <MediaNavigation
        media={mediaToShow}
        onPrevious={onPrevious}
        onNext={onNext}
        onCloseMedia={onCloseMedia}
      />
    }
    {
      mediaToShow &&
      <InfoArea open={showMediaInfo} onClose={onCloseInfo}>
        <MediaInfo
          media={mediaToShow}
          relations={relations}
          onHighlightPerson={setPersonHighlight}
        />
      </InfoArea>
    }
  </HoverContainer>;
}
