import type { BoxProps } from "@material-ui/core/Box";
import Box from "@material-ui/core/Box";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import clsx from "clsx";

import type { Overwrite } from "../../../utils/utility";
import type { BaseMediaState } from "../../api/types";
import { useSelector } from "../../store";
import type { StoreState } from "../../store/types";
import type { ReactResult } from "../../utils/types";
import { ReactMemo } from "../../utils/types";
import MediaPreview from "./MediaPreview";

interface StyleProps {
  thumbnailSize: number;
  width: number | null | undefined;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    baseGrid: {
      display: "grid",
      gridAutoRows: "1fr",
      gridGap: theme.spacing(1),
      gap: theme.spacing(1),
    },
    fixedGrid: ({ thumbnailSize }: StyleProps) => ({
      gridTemplateColumns: `repeat(auto-fill, ${theme.spacing(4) + thumbnailSize}px)`,
    }),
    flexibleGrid: ({ thumbnailSize, width: containerWidth }: StyleProps) => {
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
  width: number | null | undefined;
  onClick?: (media: T) => void;
}>;

function thumbnailSizeSelector(state: StoreState): number {
  return state.settings.thumbnailSize;
}

export default ReactMemo(function PreviewGrid<T extends BaseMediaState>({
  media,
  width,
  className,
  onClick,
  ...boxProps
}: PreviewGridProps<T>): ReactResult {
  let thumbnailSize = useSelector(thumbnailSizeSelector);
  let classes = useStyles({
    thumbnailSize,
    width,
  });

  let gridClass = clsx(
    classes.baseGrid,
    width ? classes.flexibleGrid : classes.fixedGrid,
  );

  return <Box
    className={clsx(gridClass, className)}
    {...boxProps}
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
