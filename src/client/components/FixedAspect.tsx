import { createStyles, makeStyles } from "@material-ui/core/styles";
import clsx from "clsx";
import React from "react";

import { ReactChildren, ReactResult } from "../utils/types";

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      position: "relative",
    },
    fixedArea: {
      position: "absolute",
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    },
    row: {
      textAlign: "center",
      maxHeight: "100%",
    },
    inlineArea: {
      position: "relative",
    },
    intrinsicBox: {
      maxHeight: "100%",
      maxWidth: "100%",
      verticalAlign: "bottom",
    },
    areaOverlay: ({ height, width }: FixedAspectProps) => ({
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingTop: `${100 * height / width}%`,
      textAlign: "initial",
    }),
    viewportContainer: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    viewport: {
      height: "100%",
      width: "100%",
    },
  }));

export interface FixedAspectProps {
  width: number;
  height: number;
  classes?: {
    root?: string;
    viewport?: string;
  };
}

export default function FixedAspect(props: FixedAspectProps & ReactChildren): ReactResult {
  let classes = useStyles(props);

  return <div className={clsx(classes.root, props.classes?.root)}>
    <div className={classes.fixedArea}>
      <div className={classes.row}>
        <span className={classes.inlineArea}>
          <svg className={classes.intrinsicBox} viewBox={`0 0 ${props.width} ${props.height}`}/>
          <div className={classes.areaOverlay}>
            <div className={classes.viewportContainer}>
              <div className={classes.viewport}>{props.children}</div>
            </div>
          </div>
        </span>
      </div>
    </div>
  </div>;
}
