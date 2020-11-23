import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Fade from "@material-ui/core/Fade";
import type { Theme } from "@material-ui/core/styles";
import { makeStyles, createStyles } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React, { useCallback, useState } from "react";

import type { Api } from "../../model";
import { sorted } from "../../utils";
import type { MediaState, ProcessedMediaState } from "../api/types";
import { isProcessedMedia } from "../api/types";
import type { ReactResult } from "../utils/types";
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
  children?: React.ReactNode;
}

export function Photo({
  media,
  children,
}: MediaDisplayProps): ReactResult {
  let classes = useStyles();

  let alternates = sorted(media.file.alternatives, "fileSize", (a: number, b: number) => a - b);
  return <React.Fragment>
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
    <HoverArea>
      <div
        id="media-controls"
        className={classes.mediaControls}
      >
        {children}
      </div>
    </HoverArea>
  </React.Fragment>;
}

export function Video({
  media,
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

  return <React.Fragment>
    <video
      id="media-original"
      key={media.id}
      poster={posters.length ? posters[0].url : undefined}
      controls={false}
      className={classes.media}
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
    <HoverArea>
      <div
        id="media-controls"
        className={classes.mediaControls}
      >
        {children}
      </div>
    </HoverArea>
  </React.Fragment>;
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
