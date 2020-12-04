import IconButton from "@material-ui/core/IconButton";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React from "react";

import CloseIcon from "../../icons/CloseIcon";
import NextIcon from "../../icons/NextIcon";
import PreviousIcon from "../../icons/PreviousIcon";
import type { ReactResult } from "../../utils/types";
import { HoverArea } from "../HoverArea";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      pointerEvents: "none",
    },
    overlayMiddle: {
      flexGrow: 1,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingRight: theme.spacing(1),
      paddingLeft: theme.spacing(1),
    },
    overlayTop: {
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(2),
      display: "flex",
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    navButton: {
      "fontSize": "4rem",
      "pointerEvents": "auto",
      "background": alpha(theme.palette.background.paper, 0.6),
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
    overlayButton: {
      "marginRight": theme.spacing(2),
      "pointerEvents": "auto",
      "fontSize": "2rem",
      "background": alpha(theme.palette.background.paper, 0.6),
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
  }));

export interface MediaNavigationProps {
  onNext: (() => void) | null;
  onPrevious: (() => void) | null;
  onCloseMedia: () => void;
}

export default function MediaNavigation({
  onNext,
  onPrevious,
  onCloseMedia,
}: MediaNavigationProps): ReactResult {
  let classes = useStyles();

  return <HoverArea>
    <div id="main-overlay" className={classes.overlay}>
      <div className={classes.overlayTop}>
        <IconButton
          id="close-button"
          onClick={onCloseMedia}
          className={classes.overlayButton}
        >
          <CloseIcon/>
        </IconButton>
      </div>
      <div className={classes.overlayMiddle}>
        <div>
          {
            onPrevious && <IconButton
              id="prev-button"
              onClick={onPrevious}
              className={classes.navButton}
            >
              <PreviousIcon/>
            </IconButton>
          }
        </div>
        <div>
          {
            onNext && <IconButton
              id="next-button"
              onClick={onNext}
              className={classes.navButton}
            >
              <NextIcon/>
            </IconButton>
          }
        </div>
      </div>
    </div>
  </HoverArea>;
}
