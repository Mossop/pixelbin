import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import alpha from "color-alpha";
import React, { useCallback, useRef, useState } from "react";

import type { ObjectModel } from "../../../model";
import type { ProcessedMediaState } from "../../api/types";
import FixedAspect from "../../components/FixedAspect";
import { HoverArea, HoverContainer } from "../../components/HoverArea";
import { Photo, Video } from "../../components/Media";
import CloseIcon from "../../icons/CloseIcon";
import EnterFullscreenIcon from "../../icons/EnterFullscreenIcon";
import ExitFullscreenIcon from "../../icons/ExitFullscreenIcon";
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

  let onShowInfo = useCallback(() => setShowMediaInfo(true), []);
  let onCloseInfo = useCallback(() => setShowMediaInfo(false), []);

  let goFullscreen = useCallback(() => {
    void areaRef.current?.requestFullscreen();
  }, [areaRef]);

  let exitFullscreen = useCallback(() => {
    void document.exitFullscreen();
  }, []);

  let title = mediaTitle(media);

  let mediaControls = fullscreen
    ? <IconButton id="exit-fullscreen" onClick={exitFullscreen} className={classes.overlayButton}>
      <ExitFullscreenIcon/>
    </IconButton>
    : <IconButton id="enter-fullscreen" onClick={goFullscreen} className={classes.overlayButton}>
      <EnterFullscreenIcon/>
    </IconButton>;

  return <React.Fragment>
    <HoverContainer
      id="media-display"
      className={classes.content}
      ref={areaRef}
      initial={true}
    >
      <FixedAspect
        width={media.file.width}
        height={media.file.height}
        classes={
          {
            root: classes.mediaArea,
            viewport: classes.viewport,
          }
        }
      >
        {
          media.file.mimetype.startsWith("video/")
            ? <Video media={media}>
              {mediaControls}
            </Video>
            : <Photo media={media}>
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
      <HoverArea>
        <div className={classes.overlay}>
          <MainOverlay
            onPrevious={onPrevious}
            onNext={onNext}
            onGoBack={onGoBack}
            onShowInfo={onShowInfo}
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
