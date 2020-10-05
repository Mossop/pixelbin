import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Fade from "@material-ui/core/Fade";
import { makeStyles, createStyles, Theme } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React, { useCallback } from "react";

import { getThumbnailUrl } from "../api/media";
import { isProcessed, MediaState, ProcessedMediaState } from "../api/types";
import { ReactResult } from "../utils/types";
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
    mediaControls: {
      position: "absolute",
      bottom: 0,
      right: 0,
      left: 0,
      padding: theme.spacing(1),
      background: alpha(theme.palette.background.paper, 0.6),
      display: "flex",
      flexDirection: "row",
      justifyContent: "flex-end",
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
    thumbnail: (props: PreviewStyleProps) => {
      return {
        display: "block",
        objectFit: "contain",
        objectPosition: "center center",
        width: `${props.thumbnailSize}px`,
        height: `${props.thumbnailSize}px`,
      };
    },
  }));

export interface MediaDisplayProps {
  media: ProcessedMediaState;
  displayOverlays: boolean;
  children?: React.ReactNode;
}

export function Photo(props: MediaDisplayProps): ReactResult {
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

export function Video(props: MediaDisplayProps): ReactResult {
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

interface ThumbnailProps {
  media: ProcessedMediaState;
  size: number;
}

function Thumbnail({ media, size }: ThumbnailProps): ReactResult {
  const classes = usePreviewStyles({ thumbnailSize: size });

  let ratios = [1.5, 2];
  let normal = getThumbnailUrl(media, size);
  let sizes = [normal];
  for (let ratio of ratios) {
    sizes.push(`${getThumbnailUrl(media, Math.round(size * ratio))} ${ratio}x`);
  }

  return <img srcSet={sizes.join(", ")} className={classes.thumbnail} src={normal}/>;
}

export interface PreviewProps {
  media: MediaState;
  thumbnailSize: number;
  onClick?: (media: ProcessedMediaState) => void;
}

export function Preview({ media, thumbnailSize, onClick }: PreviewProps): ReactResult {
  const classes = usePreviewStyles({ thumbnailSize });

  const click = useCallback(() => {
    if (onClick && isProcessed(media)) {
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
        isProcessed(media)
          ? <Thumbnail media={media} size={thumbnailSize}/>
          : <Loading width={thumbnailSize} height={thumbnailSize}/>
      }
    </CardContent>
  </Card>;
}
