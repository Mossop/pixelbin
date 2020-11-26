import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import React, { useCallback, useRef, useState } from "react";

import type { ObjectModel } from "../../../model";
import type { ProcessedMediaState } from "../../api/types";
import { HoverArea, HoverContainer } from "../../components/HoverArea";
import { Photo, Video } from "../../components/Media";
import CloseIcon from "../../icons/CloseIcon";
import EnterFullscreenIcon from "../../icons/EnterFullscreenIcon";
import ExitFullscreenIcon from "../../icons/ExitFullscreenIcon";
import InfoIcon from "../../icons/InfoIcon";
import { useFullscreen } from "../../utils/hooks";
import { mediaTitle } from "../../utils/metadata";
import type { ReactResult } from "../../utils/types";
import MainOverlay from "./MainOverlay";
import MediaInfo from "./MediaInfo";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    content: {
      flexGrow: 1,
      position: "relative",
      background: theme.palette.background.default,
    },
    overlay: {
      position: "absolute",
      height: "100%",
      width: "100%",
      pointerEvents: "none",
    },
    overlayButton: {
      "marginRight": theme.spacing(1),
      "fontSize": "2rem",
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
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

export interface MediaDisplayProps {
  readonly media: ProcessedMediaState;
  readonly onNext: (() => void) | null;
  readonly onPrevious: (() => void) | null;
  readonly onGoBack: (() => void) | null;
}

export default function MediaDisplay({
  media,
  onNext,
  onPrevious,
  onGoBack,
}: MediaDisplayProps): ReactResult {
  let classes = useStyles();
  let areaRef = useRef<HTMLDivElement>(null);
  let fullscreen = useFullscreen();

  let [showMediaInfo, setShowMediaInfo] = useState(false);
  let [location, setLocation] = useState<ObjectModel.Location | null>(null);

  let onShowInfo = useCallback(() => setShowMediaInfo(!showMediaInfo), [showMediaInfo]);
  let onCloseInfo = useCallback(() => setShowMediaInfo(false), []);

  let goFullscreen = useCallback(() => {
    void areaRef.current?.requestFullscreen();
  }, [areaRef]);

  let exitFullscreen = useCallback(() => {
    void document.exitFullscreen();
  }, []);

  let title = mediaTitle(media);

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

  return <React.Fragment>
    <HoverContainer
      id="media-display"
      className={classes.content}
      ref={areaRef}
      initial={true}
    >
      {
        media.file.mimetype.startsWith("video/")
          ? <Video media={media}>
            {mediaControls}
          </Video>
          : <Photo media={media} highlightRegion={location}>
            {mediaControls}
          </Photo>
      }
      <HoverArea>
        <div className={classes.overlay}>
          <MainOverlay
            onPrevious={onPrevious}
            onNext={onNext}
            onGoBack={onGoBack}
          />
        </div>
      </HoverArea>
    </HoverContainer>
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
  </React.Fragment>;
}
