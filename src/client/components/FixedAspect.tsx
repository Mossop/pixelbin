import { createStyles, makeStyles } from "@material-ui/core/styles";
import clsx from "clsx";
import React from "react";

import { ReactChildren, ReactResult } from "../utils/types";

const useStyles = makeStyles(() =>
  createStyles({
    container: {
      position: "relative",
    },
    bounds: {
      position: "absolute",
      height: "100%",
      width: "100%",
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
  const classes = useStyles();

  return <div className={clsx(classes.container, props.classes?.root)}>
    <svg id="svg" viewBox={`0 0 ${props.width} ${props.height}`} className={classes.bounds}>
      <foreignObject x="0" y="0" width="100%" height="100%">
        <div className={clsx(classes.viewport, props.classes?.viewport)}>
          {props.children}
        </div>
      </foreignObject>
    </svg>
  </div>;
}
