import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import React from "react";

import type { BaseMediaState } from "../../api/types";
import type { MediaGroup } from "../../utils/sort";
import type { ReactResult } from "../../utils/types";
import { IntersectionRoot } from "../IntersectionObserver";
import PreviewGrid from "./PreviewGrid";

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
  }));

export interface MediaGalleryProps<T extends BaseMediaState> {
  groups: readonly MediaGroup<T>[];
  onClick?: (media: T) => void;
}

export default function MediaGallery<T extends BaseMediaState>({
  groups,
  onClick,
}: MediaGalleryProps<T>): ReactResult {
  let classes = useStyles();

  return <dl className={classes.groupList}>
    <IntersectionRoot margin="250px 0px">
      {
        groups.map((group: MediaGroup<T>) => <React.Fragment key={group.id}>
          <dt id={`gallery-group-${group.id}`} className={classes.groupHeader}>
            <Typography variant="h2">{group.renderHeader()}</Typography>
          </dt>
          <PreviewGrid media={group.media} onClick={onClick} component="dd"/>
        </React.Fragment>)
      }
    </IntersectionRoot>
  </dl>;
}
