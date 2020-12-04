import Box from "@material-ui/core/Box";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import React from "react";
import { useSelector } from "react-redux";

import type { MediaState } from "../../api/types";
import type { StoreState } from "../../store/types";
import type { ReactResult } from "../../utils/types";
import { IntersectionRoot, MountOnIntersect } from "../IntersectionObserver";
import MediaPreview from "./MediaPreview";

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
  media: readonly MediaState[];
  onClick?: (media: MediaState) => void;
}

export default function MediaGallery({ media, onClick }: MediaGalleryProps): ReactResult {
  let thumbnailSize = useSelector((state: StoreState): number => state.settings.thumbnailSize);
  let classes = useStyles(thumbnailSize);

  return <Box className={classes.grid}>
    <IntersectionRoot margin={`${thumbnailSize * 2}px 0px`}>
      {
        media.map((media: MediaState) => {
          return <MountOnIntersect key={media.id} className={classes.preview}>
            <MediaPreview
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
