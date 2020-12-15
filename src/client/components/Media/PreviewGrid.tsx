import type { BoxProps } from "@material-ui/core/Box";
import Box from "@material-ui/core/Box";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import clsx from "clsx";
import React, { useState } from "react";

import type { Overwrite } from "../../../utils";
import type { BaseMediaState } from "../../api/types";
import { useSelector } from "../../store";
import type { StoreState } from "../../store/types";
import { useElementWidth } from "../../utils/hooks";
import type { ReactResult } from "../../utils/types";
import { ReactMemo } from "../../utils/types";
import MediaPreview from "./MediaPreview";

interface StyleProps {
  thumbnailSize: number;
  containerWidth: number | null | undefined;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    baseGrid: {
      margin: 0,
      display: "grid",
      gridAutoRows: "1fr",
      gridGap: theme.spacing(1),
      gap: theme.spacing(1),
    },
    fixedGrid: ({ thumbnailSize }: StyleProps) => ({
      gridTemplateColumns: `repeat(auto-fill, ${theme.spacing(4) + thumbnailSize}px)`,
    }),
    flexibleGrid: ({ thumbnailSize, containerWidth }: StyleProps) => {
      if (!containerWidth) {
        return {};
      }

      let maxSize = theme.spacing(4) + thumbnailSize * 1.2;
      let columns = Math.ceil(containerWidth / maxSize);
      return {
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      };
    },
  }));

export type PreviewGridProps<T extends BaseMediaState> = Overwrite<BoxProps, {
  media: readonly T[];
  onClick?: (media: T) => void;
}>;

export default ReactMemo(function PreviewGrid<T extends BaseMediaState>({
  media,
  className,
  onClick,
  ...boxProps
}: PreviewGridProps<T>): ReactResult {
  let [listElement, setListElement] = useState<HTMLElement | null>(null);
  let thumbnailSize = useSelector((state: StoreState): number => state.settings.thumbnailSize);
  let containerWidth = useElementWidth(listElement);
  let classes = useStyles({
    thumbnailSize,
    containerWidth,
  });

  let gridClass = clsx(
    classes.baseGrid,
    containerWidth ? classes.flexibleGrid : classes.fixedGrid,
  );

  return <Box
    className={clsx(gridClass, className)}
    {...boxProps}
    // @ts-ignore: Seems to be a bug in the types?
    ref={setListElement}
  >
    {
      media.map((media: T) => {
        return <MediaPreview
          key={media.id}
          media={media}
          thumbnailSize={thumbnailSize}
          onClick={onClick}
        />;
      })
    }
  </Box>;
});
