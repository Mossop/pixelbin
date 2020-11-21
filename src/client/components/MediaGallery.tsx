import Box from "@material-ui/core/Box";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import React from "react";

import type { MediaState, ProcessedMediaState } from "../api/types";
import { useSelector } from "../store";
import type { StoreState } from "../store/types";
import type { ReactResult } from "../utils/types";
import { IntersectionRoot, MountOnIntersect } from "./IntersectionObserver";
import Loading from "./Loading";
import { Preview } from "./Media";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    grid: (thumbnailSize: number) => {
      let itemWidth = theme.spacing(4) + thumbnailSize;
      return {
        display: "grid",
        gridAutoRows: "1fr",
        gridTemplateColumns: `repeat(auto-fill, ${itemWidth}px)`,
        gridGap: theme.spacing(1),
        gap: theme.spacing(1),
      };
    },
    preview: (thumbnailSize: number) => {
      return {
        minHeight: thumbnailSize + theme.spacing(2),
        minWidth: thumbnailSize,
      };
    },
  }));

export interface MediaGalleryProps {
  media?: readonly MediaState[] | null;
  onClick?: (media: ProcessedMediaState) => void;
}

export default function MediaGallery({ media, onClick }: MediaGalleryProps): ReactResult {
  let thumbnailSize = useSelector((state: StoreState): number => state.settings.thumbnailSize);
  let classes = useStyles(thumbnailSize);

  if (!media) {
    return <Loading flexGrow={1}/>;
  }
  return <Box className={classes.grid}>
    <IntersectionRoot margin={`${thumbnailSize * 2}px 0px`}>
      {
        media.map((media: MediaState) => {
          return <MountOnIntersect key={media.id} className={classes.preview}>
            <Preview
              media={media}
              thumbnailSize={thumbnailSize}
              onClick={onClick}
            />
          </MountOnIntersect>;
        })
      }
    </IntersectionRoot>
  </Box>;
}
