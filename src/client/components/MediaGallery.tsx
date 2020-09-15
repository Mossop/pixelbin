import Box from "@material-ui/core/Box";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import React from "react";

import { getThumbnailUrl } from "../api/media";
import { isProcessed, MediaState, ProcessedMediaState } from "../api/types";
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
        objectFit: "contain",
        objectPosition: "center center",
        width: `${props.thumbnailSize}px`,
        height: `${props.thumbnailSize}px`,
      };
    },
  }));

interface ThumbnailProps {
  media: ProcessedMediaState;
  size: number;
}

function Thumbnail({ media, size }: ThumbnailProps): ReactResult {
  const classes = useStyles({ thumbnailSize: size });

  let ratios = [1.5, 2];
  let normal = getThumbnailUrl(media, size);
  let sizes = [normal];
  for (let ratio of ratios) {
    sizes.push(`${getThumbnailUrl(media, Math.round(size * ratio))} ${ratio}x`);
  }

  return <img srcSet={sizes.join(", ")} className={classes.thumbnail} src={normal}/>;
}

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
            {
              isProcessed(media)
                ? <Thumbnail media={media} size={thumbnailSize}/>
                : <Loading width={thumbnailSize} height={thumbnailSize}/>
            }
          </CardContent>
        </Card>;
      })
    }
  </Box>;
}
