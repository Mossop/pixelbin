import Box from "@material-ui/core/Box";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import React from "react";

import { MediaState, ProcessedMediaState } from "../api/types";
import { useSelector } from "../store";
import { StoreState } from "../store/types";
import { ReactResult } from "../utils/types";
import Loading from "./Loading";
import { Preview } from "./Media";

interface StyleProps {
  thumbnailSize: number;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    grid: (props: StyleProps) => {
      let itemWidth = theme.spacing(4) + props.thumbnailSize;
      return {
        display: "grid",
        gridAutoRows: "1fr",
        gridTemplateColumns: `repeat(auto-fill, ${itemWidth}px)`,
        gridGap: theme.spacing(1),
        gap: theme.spacing(1),
      };
    },
  }));

export interface MediaGalleryProps {
  media?: readonly MediaState[] | null;
  onClick?: (media: ProcessedMediaState) => void;
}

export default function MediaGallery(props: MediaGalleryProps): ReactResult {
  let thumbnailSize = useSelector((state: StoreState): number => state.settings.thumbnailSize);
  const classes = useStyles({ thumbnailSize });

  if (!props.media) {
    return <Loading flexGrow={1}/>;
  }
  return <Box className={classes.grid}>
    {
      props.media.map((media: MediaState) => {
        return <Preview
          key={media.id}
          media={media}
          thumbnailSize={thumbnailSize}
          onClick={props.onClick}
        />;
      })
    }
  </Box>;
}
