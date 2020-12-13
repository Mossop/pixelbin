import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import React from "react";
import { useSelector } from "react-redux";

import type { BaseMediaState } from "../../api/types";
import type { StoreState } from "../../store/types";
import type { MediaGroup } from "../../utils/sort";
import type { ReactResult } from "../../utils/types";
import { IntersectionRoot, MountOnIntersect } from "../IntersectionObserver";
import MediaPreview from "./MediaPreview";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    groupList: {
      margin: 0,
    },
    groupHeader: {
      "paddingTop": theme.spacing(3),
      "paddingLeft": theme.spacing(1),
      "&:first-child": {
        paddingTop: 0,
      },
    },
    grid: (thumbnailSize: number) => {
      let itemWidth = theme.spacing(4) + thumbnailSize;
      return {
        margin: 0,
        paddingTop: theme.spacing(1),
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

export interface MediaGalleryProps<T extends BaseMediaState> {
  groups: readonly MediaGroup<T>[];
  onClick?: (media: T) => void;
}

export default function MediaGallery<T extends BaseMediaState>({
  groups,
  onClick,
}: MediaGalleryProps<T>): ReactResult {
  let thumbnailSize = useSelector((state: StoreState): number => state.settings.thumbnailSize);
  let classes = useStyles(thumbnailSize);

  return <dl className={classes.groupList}>
    <IntersectionRoot margin={`${thumbnailSize * 2}px 0px`}>
      {
        groups.map((group: MediaGroup<T>) => <React.Fragment key={group.id}>
          <dt id={`gallery-group-${group.id}`} className={classes.groupHeader}>
            <Typography variant="h2">{group.renderHeader()}</Typography>
          </dt>
          <dd className={classes.grid}>
            {
              group.media.map((media: T) => {
                return <MountOnIntersect key={media.id} className={classes.preview}>
                  <MediaPreview
                    media={media}
                    thumbnailSize={thumbnailSize}
                    onClick={onClick}
                  />
                </MountOnIntersect>;
              })
            }
          </dd>
        </React.Fragment>)
      }
    </IntersectionRoot>
  </dl>;
}
