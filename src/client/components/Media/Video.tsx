import IconButton from "@material-ui/core/IconButton";
import LinearProgress from "@material-ui/core/LinearProgress";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import alpha from "color-alpha";
import { useCallback, useRef, useState } from "react";

import type { Encoding, MediaFileState } from "../../api/types";
import { PauseIcon, PlayIcon } from "../../icons/MediaIcons";
import type { ReactResult } from "../../utils/types";
import { HoverArea } from "../HoverArea";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    media: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
    time: {
      padding: theme.spacing(1),
      color: theme.palette.text.primary,
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
  currentTime: string;
}

export interface VideoProps {
  mediaFile: MediaFileState;
  onLoad: () => void;
  children?: React.ReactNode;
}

export function Video({
  mediaFile,
  onLoad,
  children,
}: VideoProps): ReactResult {
  let classes = useStyles();

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
    currentTime: "0:00",
  });
  let updateState = useCallback(() => {
    let formattedTime = (time: number): string => {
      let minutes = Math.floor(time / 60);
      let seconds = Math.round(time % 60);

      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    let state: VideoState = {
      playing: false,
      progress: null,
      currentTime: "0:00",
    };

    let tag = video.current;
    if (!tag) {
      setVideoState(state);
      return;
    }

    state.playing = !tag.paused;
    state.currentTime = formattedTime(tag.currentTime);

    let { duration } = tag;
    if (duration && !Number.isNaN(duration) && Number.isFinite(duration)) {
      state.progress = 100 * tag.currentTime / duration;
      state.currentTime += ` / ${formattedTime(duration)}`;
    }

    setVideoState(state);
  }, []);

  let poster = mediaFile.encodings.find(
    (encoding: Encoding): boolean => encoding.mimetype == "image/jpeg",
  );

  return <>
    <video
      id="media-original"
      ref={video}
      poster={poster?.url}
      controls={false}
      className={classes.media}
      onPlay={updateState}
      onPause={updateState}
      onProgress={updateState}
      onTimeUpdate={updateState}
      onClick={videoState.playing ? pause : play}
      onLoadedData={onLoad}
    >
      {
        mediaFile.videoEncodings.map((encoding: Encoding) => <source
          key={encoding.mimetype}
          src={encoding.url}
          type={encoding.mimetype}
        />)
      }
      <source src={mediaFile.url} type={mediaFile.mimetype}/>
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
        <Typography variant="h6" className={classes.time}>{videoState.currentTime}</Typography>
        {children}
      </div>
    </HoverArea>
  </>;
}
