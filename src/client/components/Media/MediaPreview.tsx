import Fade from "@material-ui/core/Fade";
import Paper from "@material-ui/core/Paper";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import Rating from "@material-ui/lab/Rating/Rating";
import clsx from "clsx";
import alpha from "color-alpha";
import type { Draft } from "immer";
import React, { useCallback, useState } from "react";

import type { BaseMediaState, MediaFileState } from "../../api/types";
import { isProcessed } from "../../api/types";
import PhotoIcon from "../../icons/PhotoIcon";
import VideoIcon from "../../icons/VideoIcon";
import type { UIState } from "../../store/types";
import type { ReactResult } from "../../utils/types";
import { ReactMemo } from "../../utils/types";
import { IntersectionState, useIntersectionState } from "../IntersectionObserver";
import UILink from "../Link";
import Loading from "../Loading";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    unmounted: {
      paddingTop: "100%",
    },
    preview: {
      "position": "relative",
      "padding": theme.spacing(2),
      "&:hover .hoverOpacity": {
        filter: "opacity(1)",
      },
    },
    thumbnailOuter: {
      width: "100%",
      paddingTop: "100%",
      position: "relative",
    },
    thumbnailInner: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    thumbnailContainer: {
      height: "100%",
      width: "100%",
    },
    thumbnail: {
      display: "block",
      objectFit: "contain",
      objectPosition: "center center",
      width: "100%",
      height: "100%",
    },
    overlayBar: {
      backgroundColor: alpha(theme.palette.background.paper, 0.7),
      position: "absolute",
      padding: theme.spacing(1),
      bottom: 0,
      left: 0,
      right: 0,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: "1.05rem",
      filter: "opacity(0.5)",
      transition: "filter 225ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
    },
  }));

interface ThumbnailProps {
  mediaFile: MediaFileState;
  size: number;
}

const Thumbnail = ReactMemo(function Thumbnail({ mediaFile, size }: ThumbnailProps): ReactResult {
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
});

export interface MediaPreviewProps<T extends BaseMediaState> {
  media: T;
  thumbnailSize: number;
  targetUIState?: Draft<UIState>;
}

export default ReactMemo(function MediaPreview<T extends BaseMediaState>({
  media,
  thumbnailSize,
  targetUIState,
}: MediaPreviewProps<T>): ReactResult {
  let classes = useStyles(thumbnailSize);

  let { state, setElement } = useIntersectionState();

  if (state != IntersectionState.Intersecting) {
    return <div className={classes.unmounted} ref={setElement}/>;
  }

  let component = <Paper
    className={classes.preview}
    elevation={3}
    ref={setElement}
  >
    <div className={classes.thumbnailOuter}>
      {
        isProcessed(media)
          ? <div className={classes.thumbnailInner}>
            <Thumbnail mediaFile={media.file} size={thumbnailSize}/>
          </div>
          : <Loading className={classes.thumbnailInner}/>
      }
    </div>
    <div className={clsx(classes.overlayBar, "hoverOpacity")}>
      <div>
        <Rating value={media.rating} readOnly={true}/>
      </div>
      <div>
        {
          media.file?.mimetype.startsWith("image/") && <PhotoIcon/>
        }
        {
          media.file?.mimetype.startsWith("video/") && <VideoIcon/>
        }
      </div>
    </div>
  </Paper>;

  if (targetUIState) {
    return <UILink to={targetUIState}>{component}</UILink>;
  }

  return component;
});
