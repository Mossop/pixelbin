import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Fade from "@material-ui/core/Fade";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import React, { useCallback, useState } from "react";

import type { MediaState, ProcessedMediaState } from "../../api/types";
import { isProcessedMedia } from "../../api/types";
import type { ReactResult } from "../../utils/types";
import Loading from "../Loading";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    preview: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    },
    thumbnail: (thumbnailSize: number) => {
      return {
        display: "block",
        objectFit: "contain",
        objectPosition: "center center",
        width: `${thumbnailSize}px`,
        height: `${thumbnailSize}px`,
      };
    },
  }));

interface ThumbnailProps {
  media: ProcessedMediaState;
  size: number;
}

function Thumbnail({ media, size }: ThumbnailProps): ReactResult {
  let classes = useStyles(size);
  let [loaded, setLoaded] = useState(false);

  let typedSrcs: Map<string, string[]> = new Map();
  let normalSrcs: string[] = [];

  for (let thumb of media.file.thumbnails) {
    if (thumb.mimetype == "image/jpeg") {
      normalSrcs.push(`${thumb.url} ${thumb.size}w`);
    } else {
      let srcs = typedSrcs.get(thumb.mimetype);
      if (srcs === undefined) {
        srcs = [];
        typedSrcs.set(thumb.mimetype, srcs);
      }
      srcs.push(`${thumb.url} ${thumb.size}w`);
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

export interface MediaPreviewProps {
  media: MediaState;
  thumbnailSize: number;
  onClick?: (media: MediaState) => void;
}

export default function MediaPreview({
  media,
  thumbnailSize,
  onClick,
}: MediaPreviewProps): ReactResult {
  let classes = useStyles(thumbnailSize);
  let click = useCallback(() => {
    if (onClick) {
      onClick(media);
    }
  }, [onClick, media]);

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
