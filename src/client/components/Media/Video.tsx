import IconButton from "@material-ui/core/IconButton";
import LinearProgress from "@material-ui/core/LinearProgress";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React, { useCallback, useRef, useState } from "react";

import type { Api } from "../../../model";
import { sorted } from "../../../utils";
import type { ProcessedMediaState } from "../../api/types";
import { PauseIcon, PlayIcon } from "../../icons/MediaIcons";
import type { ReactResult } from "../../utils/types";
import { HoverArea } from "../HoverArea";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
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
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(2),
      background: alpha(theme.palette.background.paper, 0.6),
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    play: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: 0,
      left: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
    },
    mediaControl: {
      "marginLeft": theme.spacing(1),
      "fontSize": "2rem",
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
    navButton: {
      "fontSize": "4rem",
      "pointerEvents": "auto",
      "background": alpha(theme.palette.background.paper, 0.6),
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
      "&:hover": {
        background: alpha(theme.palette.background.paper, 0.6),
      },
    },
    scrubber: {
      flex: 1,
      margin: theme.spacing(1),
      height: 8,
    },
  }));

interface VideoState {
  playing: boolean;
  progress: number | null;
}

export interface VideoProps {
  media: ProcessedMediaState;
  children?: React.ReactNode;
}

export function Video({
  media,
  children,
}: VideoProps): ReactResult {
  let classes = useStyles();

  let alternates = sorted(
    media.file.alternatives.filter((alt: Api.Alternate) => alt.mimetype.startsWith("video/")),
    "fileSize",
    (a: number, b: number) => a - b,
  );

  let posters = sorted(
    media.file.alternatives.filter((alt: Api.Alternate) => alt.mimetype.startsWith("image/")),
    "fileSize",
    (a: number, b: number) => a - b,
  );

  let video = useRef<HTMLVideoElement>(null);

  let play = useCallback(() => {
    void video.current?.play();
  }, []);
  let pause = useCallback(() => {
    video.current?.pause();
  }, []);

  let [videoState, setVideoState] = useState<VideoState>({
    playing: false,
    progress: null,
  });
  let updateState = useCallback(() => {
    let tag = video.current;
    if (!tag) {
      setVideoState({
        playing: false,
        progress: null,
      });
      return;
    }

    let state: VideoState = {
      playing: !tag.paused,
      progress: null,
    };

    let { duration } = tag;
    if (duration && !Number.isNaN(duration) && Number.isFinite(duration)) {
      state.progress = 100 * tag.currentTime / duration;
    }

    setVideoState(state);
  }, []);

  return <React.Fragment>
    <video
      id="media-original"
      ref={video}
      key={media.id}
      poster={posters.length ? posters[0].url : undefined}
      controls={false}
      className={classes.media}
      onPlay={updateState}
      onPause={updateState}
      onProgress={updateState}
      onTimeUpdate={updateState}
      onClick={videoState.playing ? pause : play}
    >
      {
        alternates.map((alternate: Api.Alternate) => <source
          key={alternate.url}
          src={alternate.url}
          type={alternate.mimetype}
        />)
      }
      <source src={media.file.originalUrl} type={media.file.mimetype}/>
    </video>
    {
      !videoState.playing &&
      <div className={classes.play}>
        <IconButton
          onClick={play}
          className={classes.navButton}
        >
          <PlayIcon/>
        </IconButton>
      </div>
    }
    <HoverArea>
      <div
        id="media-controls"
        className={classes.mediaControls}
      >
        {
          !videoState.playing
            ? <IconButton
              id="video-play"
              onClick={play}
              className={classes.mediaControl}
            >
              <PlayIcon/>
            </IconButton>
            : <IconButton
              id="video-pause"
              onClick={pause}
              className={classes.mediaControl}
            >
              <PauseIcon/>
            </IconButton>
        }
        {
          videoState.progress == null
            ? <LinearProgress className={classes.scrubber}/>
            : <LinearProgress
              className={classes.scrubber}
              variant="determinate"
              value={videoState.progress}
            />
        }
        {children}
      </div>
    </HoverArea>
  </React.Fragment>;
}
