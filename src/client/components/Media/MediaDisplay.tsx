import Drawer from "@material-ui/core/Drawer";
import Fade from "@material-ui/core/Fade";
import IconButton from "@material-ui/core/IconButton";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import React, { useCallback, useMemo, useRef, useState } from "react";

import type { Person, Reference } from "../../api/highlevel";
import { getMediaRelations } from "../../api/media";
import type { BaseMediaState, MediaRelations } from "../../api/types";
import { isProcessed } from "../../api/types";
import EnterFullscreenIcon from "../../icons/EnterFullscreenIcon";
import ExitFullscreenIcon from "../../icons/ExitFullscreenIcon";
import InfoIcon from "../../icons/InfoIcon";
import { useFullscreen, usePromise } from "../../utils/hooks";
import type { ReactResult } from "../../utils/types";
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
    overlayButton: {
      "marginRight": theme.spacing(1),
      "fontSize": "2rem",
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
  }));

export interface MediaDisplayProps<T extends BaseMediaState> {
  media: readonly T[] | null;
  selectedMedia: string;
  onChangeMedia: (media: T) => void;
  onCloseMedia: () => void;
}

export default function MediaDisplay<T extends BaseMediaState>({
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

  let mediaControls = <React.Fragment>
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
  </React.Fragment>;

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
    initial={true}
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
    <MediaNavigation
      onPrevious={onPrevious}
      onNext={onNext}
      onCloseMedia={onCloseMedia}
    />
    {
      mediaToShow &&
      <Drawer anchor="right" open={showMediaInfo} onClose={onCloseInfo}>
        <MediaInfo
          media={mediaToShow}
          relations={relations}
          onHighlightPerson={setPersonHighlight}
        />
      </Drawer>
    }
  </HoverContainer>;
}
