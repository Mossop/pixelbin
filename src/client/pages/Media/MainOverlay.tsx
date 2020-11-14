import IconButton from "@material-ui/core/IconButton";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React from "react";

import CloseIcon from "../../icons/CloseIcon";
import InfoIcon from "../../icons/InfoIcon";
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
      background: alpha(theme.palette.background.paper, 0.6),
      padding: theme.spacing(2),
      pointerEvents: "auto",
      display: "flex",
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    navButton: {
      "fontSize": "4rem",
      "background": alpha(theme.palette.background.paper, 0.6),
      "pointerEvents": "auto",
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
    overlayButton: {
      "fontSize": "2rem",
      "& .MuiSvgIcon-root": {
        fontSize: "inherit",
      },
    },
  }));

interface MainOverlayProps {
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  onGoBack?: (() => void) | null;
  onShowInfo?: (() => void) | null;
}

export default function MainOverlay({
  onNext,
  onPrevious,
  onGoBack,
  onShowInfo,
}: MainOverlayProps): ReactResult {
  let classes = useStyles();

  return <div id="main-overlay" className={classes.overlayContent}>
    <div className={classes.overlayTop}>
      {
        onShowInfo && <IconButton
          id="info-button"
          onClick={onShowInfo}
          className={classes.overlayButton}
        >
          <InfoIcon/>
        </IconButton>
      }
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
