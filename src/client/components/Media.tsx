import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Fade from "@material-ui/core/Fade";
import type { Theme } from "@material-ui/core/styles";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React, { useCallback } from "react";

import { getThumbnailUrl } from "../api/media";
import type { MediaState, ProcessedMediaState } from "../api/types";
import { isProcessed } from "../api/types";
import type { ReactResult } from "../utils/types";
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
  displayOverlays: boolean;
  children?: React.ReactNode;
}

export function Photo({
  media,
  displayOverlays,
  children,
}: MediaDisplayProps): ReactResult {
  let classes = useStyles();

  return <React.Fragment>
    <img
      key={media.id}
      src={media.originalUrl}
      className={classes.media}
    />
    <Fade in={displayOverlays} timeout={500}>
      <div className={classes.mediaControls}>
        {children}
      </div>
    </Fade>
  </React.Fragment>;
}

export function Video({
  media,
  displayOverlays,
  children,
}: MediaDisplayProps): ReactResult {
  let classes = useStyles();

  return <React.Fragment>
    <video
      key={media.id}
      poster={media.posterUrl ?? undefined}
      controls={false}
      className={classes.media}
    >
      <source src={media.originalUrl} type={media.mimetype}/>
    </video>
    <Fade in={displayOverlays} timeout={500}>
      <div className={classes.mediaControls}>
        {children}
      </div>
    </Fade>
  </React.Fragment>;
}

interface ThumbnailProps {
  media: ProcessedMediaState;
  size: number;
}

function Thumbnail({ media, size }: ThumbnailProps): ReactResult {
  let classes = usePreviewStyles({ thumbnailSize: size });

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
  let classes = usePreviewStyles({ thumbnailSize });

  let click = useCallback(() => {
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
