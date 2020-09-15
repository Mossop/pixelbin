import Box from "@material-ui/core/Box";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import React from "react";

import { MediaState } from "../api/types";
import { useSelector } from "../store";
import { StoreState } from "../store/types";
import { ReactResult } from "../utils/types";
import Loading from "./Loading";

interface StyleProps {
  thumbnailSize: number;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    grid: (props: StyleProps) => {
      let itemWidth = theme.spacing(2) + props.thumbnailSize;
      return {
        display: "grid",
        gridAutoRows: "1fr",
        gridTemplateColumns: `repeat(auto-fill, minmax(${itemWidth}px, 1fr))`,
        gridGap: theme.spacing(1),
        gap: theme.spacing(1),
      };
    },
    media: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: theme.spacing(1),
    },
    thumbnail: (props: StyleProps) => {
      return {
        display: "block",
        width: `${props.thumbnailSize}px`,
        height: `${props.thumbnailSize}px`,
      };
    },
  }));

export interface MediaGalleryProps {
  media?: readonly MediaState[];
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
        return <Card
          key={media.id}
          className={classes.media}
        >
          <CardContent>
            <picture className={classes.thumbnail}>
              <img/>
            </picture>
          </CardContent>
        </Card>;
      })
    }
  </Box>;
}
