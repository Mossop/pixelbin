import { Localized } from "@fluent/react";
import { Fade } from "@material-ui/core";
import IconButton from "@material-ui/core/IconButton";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import alpha from "color-alpha";
import { useEffect, useMemo } from "react";

import CloseIcon from "../../icons/CloseIcon";
import NextIcon from "../../icons/NextIcon";
import PreviousIcon from "../../icons/PreviousIcon";
import { useSelector } from "../../store";
import { useActions } from "../../store/actions";
import type { StoreState } from "../../store/types";
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
      position: "relative",
    },
    touchMessageOverlay: {
      position: "absolute",
      top: 0,
      left: theme.spacing(1),
      right: theme.spacing(1),
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    touchMessage: {
      background: alpha(theme.palette.background.paper, 0.6),
      color: theme.palette.text.primary,
      padding: theme.spacing(2),
      fontSize: "2rem",
      margin: 0,
      textAlign: "center",
    },
    overlayTop: {
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(2),
      background: alpha(theme.palette.background.paper, 0.6),
      fontSize: "4rem",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    },
    mediaInfo: {
      flex: 1,
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

function seenTouchMessageSelector(state: StoreState): boolean {
  return state.settings.seenTouchMessage;
}

export default function MediaNavigation({
  onNext,
  onPrevious,
  onCloseMedia,
}: MediaNavigationProps): ReactResult {
  let classes = useStyles();
  let canHover = useMemo(() => window.matchMedia("(any-hover: hover)").matches, []);
  let showMessage = !useSelector(seenTouchMessageSelector) && !canHover;
  let actions = useActions();

  useEffect(() => {
    setTimeout(() => actions.seenTouchMessage(), 4000);
  }, [actions]);

  return <div id="main-overlay" className={classes.overlay}>
    <HoverArea>
      <div className={classes.overlayTop}>
        <Typography className={classes.mediaInfo} component="p">Hello</Typography>
        <IconButton
          id="close-button"
          onClick={onCloseMedia}
          className={classes.overlayButton}
        >
          <CloseIcon/>
        </IconButton>
      </div>
    </HoverArea>
    <div className={classes.overlayMiddle}>
      {
        !showMessage &&
        <>
          <div>
            {
              onPrevious && <HoverArea key="previous">
                <IconButton
                  id="prev-button"
                  onClick={onPrevious}
                  className={classes.navButton}
                >
                  <PreviousIcon/>
                </IconButton>
              </HoverArea>
            }
          </div>
          <div>
            {
              onNext && <HoverArea key="next">
                <IconButton
                  id="next-button"
                  onClick={onNext}
                  className={classes.navButton}
                >
                  <NextIcon/>
                </IconButton>
              </HoverArea>
            }
          </div>
        </>
      }
      <Fade in={showMessage} unmountOnExit={true}>
        <div className={classes.touchMessageOverlay}>
          <Localized id="media-touch-controls-message">
            <p className={classes.touchMessage}/>
          </Localized>
        </div>
      </Fade>
    </div>
  </div>;
}
