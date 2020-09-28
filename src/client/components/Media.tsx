import Fade from "@material-ui/core/Fade";
import { makeStyles, createStyles, Theme } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React from "react";

import { ProcessedMediaState } from "../api/types";
import { ReactResult } from "../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    media: {
      position: "absolute",
      height: "100%",
      width: "100%",
      objectPosition: "center center",
      objectFit: "contain",
    },
    mediaControls: {
      position: "absolute",
      bottom: 0,
      right: 0,
      left: 0,
      padding: theme.spacing(1),
      background: alpha(theme.palette.background.paper, 0.6),
      display: "flex",
      flexDirection: "row",
      justifyContent: "flex-end",
    },
  }));

export interface MediaDisplayProps {
  media: ProcessedMediaState;
  displayOverlays: boolean;
  children?: React.ReactNode;
}

export function Photo(props: MediaDisplayProps): ReactResult {
  const classes = useStyles();

  return <React.Fragment>
    <img
      key={props.media.id}
      src={props.media.originalUrl}
      className={classes.media}
    />
    <Fade in={props.displayOverlays} timeout={500}>
      <div className={classes.mediaControls}>
        {props.children}
      </div>
    </Fade>
  </React.Fragment>;
}

export function Video(props: MediaDisplayProps): ReactResult {
  const classes = useStyles();

  return <React.Fragment>
    <video
      key={props.media.id}
      poster={props.media.posterUrl ?? undefined}
      controls={false}
      className={classes.media}
    >
      <source src={props.media.originalUrl} type={props.media.mimetype}/>
    </video>
    <Fade in={props.displayOverlays} timeout={500}>
      <div className={classes.mediaControls}>
        {props.children}
      </div>
    </Fade>
  </React.Fragment>;
}
