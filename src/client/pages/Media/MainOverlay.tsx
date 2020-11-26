import IconButton from "@material-ui/core/IconButton";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React from "react";

import CloseIcon from "../../icons/CloseIcon";
import NextIcon from "../../icons/NextIcon";
import PreviousIcon from "../../icons/PreviousIcon";
import type { ReactResult } from "../../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    overlayContent: {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
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

interface MainOverlayProps {
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  onGoBack?: (() => void) | null;
}

export default function MainOverlay({
  onNext,
  onPrevious,
  onGoBack,
}: MainOverlayProps): ReactResult {
  let classes = useStyles();

  return <div id="main-overlay" className={classes.overlayContent}>
    <div className={classes.overlayTop}>
      {
        onGoBack && <IconButton
          id="back-button"
          onClick={onGoBack}
          className={classes.overlayButton}
        >
          <CloseIcon/>
        </IconButton>
      }
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
  </div>;
}
