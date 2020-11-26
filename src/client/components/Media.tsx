import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Fade from "@material-ui/core/Fade";
import IconButton from "@material-ui/core/IconButton";
import LinearProgress from "@material-ui/core/LinearProgress";
import type { Theme } from "@material-ui/core/styles";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React, { useCallback, useRef, useState } from "react";

import type { Api, ObjectModel } from "../../model";
import { sorted } from "../../utils";
import type { MediaState, ProcessedMediaState } from "../api/types";
import { isProcessedMedia } from "../api/types";
import { PauseIcon, PlayIcon } from "../icons/MediaIcons";
import type { ReactResult } from "../utils/types";
import FixedAspect from "./FixedAspect";
import { HoverArea } from "./HoverArea";
import Loading from "./Loading";

interface PreviewStyleProps {
  thumbnailSize: number;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    media: {
      position: "absolute",
      height: "100%",
      width: "100%",
      objectPosition: "center center",
      objectFit: "contain",
    },
    container: {
      position: "absolute",
      height: "100%",
      width: "100%",
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
    mediaControl: {
      "marginLeft": theme.spacing(1),
      "fontSize": "2rem",
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
    highlightRegion: {
      position: "absolute",
      borderWidth: 2,
      borderStyle: "solid",
      borderColor: theme.palette.primary.dark,
    },
    scrubber: {
      flex: 1,
      margin: theme.spacing(1),
      height: 8,
    },
  }));

const usePreviewStyles = makeStyles((theme: Theme) =>
  createStyles({
    preview: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    },
    thumbnail: ({ thumbnailSize }: PreviewStyleProps) => {
      return {
        display: "block",
        objectFit: "contain",
        objectPosition: "center center",
        width: `${thumbnailSize}px`,
        height: `${thumbnailSize}px`,
      };
    },
  }));

export interface MediaDisplayProps {
  media: ProcessedMediaState;
  highlightRegion?: ObjectModel.Location | null;
  children?: React.ReactNode;
}

export function Photo({
  media,
  highlightRegion,
  children,
}: MediaDisplayProps): ReactResult {
  let classes = useStyles();

  let alternates = sorted(media.file.alternatives, "fileSize", (a: number, b: number) => a - b);
  return <div className={classes.container}>
    <FixedAspect
      width={media.file.width}
      height={media.file.height}
      classes={
        {
          root: classes.container,
        }
      }
    >
      <picture>
        {
          alternates.map((alternate: Api.Alternate) => <source
            key={alternate.url}
            srcSet={alternate.url}
            type={alternate.mimetype}
          />)
        }
        <img
          id="media-original"
          key={media.id}
          src={media.file.originalUrl}
          className={classes.media}
        />
      </picture>
      {
        highlightRegion &&
        <div
          id="highlight-region"
          className={classes.highlightRegion}
          style={
            {
              left: `${highlightRegion.left * 100}%`,
              top: `${highlightRegion.top * 100}%`,
              right: `${100 - highlightRegion.right * 100}%`,
              bottom: `${100 - highlightRegion.bottom * 100}%`,
            }
          }
        />
      }
    </FixedAspect>
    <HoverArea>
      <div
        id="media-controls"
        className={classes.mediaControls}
      >
        {children}
      </div>
    </HoverArea>
  </div>;
}

interface VideoState {
  playing: boolean;
  progress: number | null;
}

export function Video({
  media,
  highlightRegion,
  children,
}: MediaDisplayProps): ReactResult {
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

  return <div className={classes.container}>
    <FixedAspect
      width={media.file.width}
      height={media.file.height}
      classes={
        {
          root: classes.container,
        }
      }
    >
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
        highlightRegion &&
        <div
          id="highlight-region"
          className={classes.highlightRegion}
          style={
            {
              left: `${highlightRegion.left * 100}%`,
              top: `${highlightRegion.top * 100}%`,
              right: `${100 - highlightRegion.right * 100}%`,
              bottom: `${100 - highlightRegion.bottom * 100}%`,
            }
          }
        />
      }
    </FixedAspect>
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
  </div>;
}

interface ThumbnailProps {
  media: ProcessedMediaState;
  size: number;
}

function Thumbnail({ media, size }: ThumbnailProps): ReactResult {
  let classes = usePreviewStyles({ thumbnailSize: size });
  let [loaded, setLoaded] = useState(false);

  let typedSrcs: Map<string, string[]> = new Map();
  let normalSrcs: string[] = [];

  let thumbs = sorted(media.file.thumbnails, "width", (a: number, b: number) => a - b);

  for (let thumb of thumbs) {
    if (thumb.mimetype == "image/jpeg") {
      normalSrcs.push(`${thumb.url} ${thumb.width}w`);
    } else {
      let srcs = typedSrcs.get(thumb.mimetype);
      if (srcs === undefined) {
        srcs = [];
        typedSrcs.set(thumb.mimetype, srcs);
      }
      srcs.push(`${thumb.url} ${thumb.width}w`);
    }
  }

  let onload = useCallback(() => setLoaded(true), []);
  if (media.file.width < media.file.height) {
    size = size * media.file.width / media.file.height;
  }

  let sources = [...typedSrcs.entries()];
  return <Fade in={loaded}>
    <picture>
      {
        sources.map(([type, srcs]: [string, string[]]) => <source
          key={type}
          sizes={`${size}px`}
          srcSet={srcs.join(", ")}
          type={type}
        />)
      }
      <img
        onLoad={onload}
        sizes={`${size}px`}
        srcSet={normalSrcs.join(", ")}
        className={classes.thumbnail}
      />
    </picture>
  </Fade>;
}

export interface PreviewProps {
  media: MediaState;
  thumbnailSize: number;
  onClick?: (media: ProcessedMediaState) => void;
}

export function Preview({ media, thumbnailSize, onClick }: PreviewProps): ReactResult {
  let classes = usePreviewStyles({ thumbnailSize });

  let click = useCallback(() => {
    if (onClick && isProcessedMedia(media)) {
      onClick(media);
    }
  }, [media, onClick]);

  return <Card
    key={media.id}
    className={classes.preview}
    onClick={click}
  >
    <CardContent>
      {
        isProcessedMedia(media)
          ? <Thumbnail media={media} size={thumbnailSize}/>
          : <Loading width={thumbnailSize} height={thumbnailSize}/>
      }
    </CardContent>
  </Card>;
}
