import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import alpha from "color-alpha";
import type { Draft } from "immer";
import { useState } from "react";

import type { BaseMediaState } from "../../api/types";
import type { UIState } from "../../store/types";
import type { MediaGroup } from "../../utils/sort";
import type { ReactResult } from "../../utils/types";
import { ReactMemo } from "../../utils/types";
import { IntersectionRoot } from "../IntersectionObserver";
import { SectionHeader } from "../Text";
import PreviewGrid from "./PreviewGrid";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    groupList: {
      flex: 1,
      overflow: "scroll",
    },
    groupHeader: () => {
      let gradientStops = [
        `${alpha(theme.palette.background.default, 0.85)} calc(100% - ${theme.spacing(2)}px) 80%`,
        alpha(theme.palette.background.default, 0),
      ];

      return {
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),
        paddingBottom: theme.spacing(1),
        paddingTop: theme.spacing(1),
        position: "sticky",
        top: 0,
        backgroundImage: `linear-gradient(${gradientStops.join(", ")})`,
        backgroundPosition: "bottom",
        backgroundRepeat: "no-repeat",
        zIndex: 1,
      };
    },
    groupGrid: {
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      paddingBottom: theme.spacing(2),
    },
  }));

export interface MediaGalleryProps<T extends BaseMediaState> {
  groups: readonly MediaGroup<T>[];
  width: number | undefined;
  getMediaUIState?: (media: T) => Draft<UIState>;
}

export default ReactMemo(function MediaGallery<T extends BaseMediaState>({
  groups,
  width,
  getMediaUIState,
}: MediaGalleryProps<T>): ReactResult {
  let [element, setElement] = useState<HTMLElement | null>(null);
  let classes = useStyles();

  return <dl className={classes.groupList} ref={setElement}>
    <IntersectionRoot margin="500px 0px" root={element}>
      {
        groups.map((group: MediaGroup<T>) => <section key={group.id}>
          <div id={`gallery-group-${group.id}`} className={classes.groupHeader}>
            <SectionHeader>{group.renderHeader()}</SectionHeader>
          </div>
          <PreviewGrid
            width={width}
            media={group.media}
            getMediaUIState={getMediaUIState}
            className={classes.groupGrid}
          />
        </section>)
      }
    </IntersectionRoot>
  </dl>;
});
