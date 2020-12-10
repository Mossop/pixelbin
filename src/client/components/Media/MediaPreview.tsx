import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Fade from "@material-ui/core/Fade";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import React, { useCallback, useState } from "react";

import type { BaseMediaState, MediaFileState } from "../../api/types";
import { isProcessed } from "../../api/types";
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
  mediaFile: MediaFileState;
  size: number;
}

function Thumbnail({ mediaFile, size }: ThumbnailProps): ReactResult {
  let classes = useStyles(size);
  let [loaded, setLoaded] = useState(false);

  let typedSrcs: Map<string, string[]> = new Map();
  let normalSrcs: string[] = [];

  for (let thumb of mediaFile.thumbnails) {
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
  if (mediaFile.width < mediaFile.height) {
    size = size * mediaFile.width / mediaFile.height;
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

export interface MediaPreviewProps<T extends BaseMediaState> {
  media: T;
  thumbnailSize: number;
  onClick?: (media: T) => void;
}

export default function MediaPreview<T extends BaseMediaState>({
  media,
  thumbnailSize,
  onClick,
}: MediaPreviewProps<T>): ReactResult {
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
        isProcessed(media)
          ? <Thumbnail mediaFile={media.file} size={thumbnailSize}/>
          : <Loading width={thumbnailSize} height={thumbnailSize}/>
      }
    </CardContent>
  </Card>;
}
