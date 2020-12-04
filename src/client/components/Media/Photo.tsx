import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React from "react";

import type { Api } from "../../../model";
import { sorted } from "../../../utils";
import type { ProcessedMediaState } from "../../api/types";
import type { ReactResult } from "../../utils/types";
import { HoverArea } from "../HoverArea";

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
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(2),
      background: alpha(theme.palette.background.paper, 0.6),
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
  }));

export interface PhotoProps {
  media: ProcessedMediaState;
  children?: React.ReactNode;
}

export function Photo({
  media,
  children,
}: PhotoProps): ReactResult {
  let classes = useStyles();

  let alternates = sorted(media.file.alternatives, "fileSize", (a: number, b: number) => a - b);
  let jpegPos = alternates.length - 1;
  while (jpegPos >= 0 && alternates[jpegPos].mimetype != "image/jpeg") {
    jpegPos--;
  }

  let fallbackUrl: string;
  if (jpegPos >= 0) {
    let [jpegAlternate] = alternates.splice(jpegPos, 1);
    fallbackUrl = jpegAlternate.url;
  } else {
    fallbackUrl = media.file.originalUrl;
  }

  return <React.Fragment>
    <picture>
      {
        alternates.map((alternate: Api.Alternate) => <source
          key={alternate.url}
          srcSet={alternate.url}
          type={alternate.mimetype}
        />)
      }
      <img
        id="media-fallback"
        key={media.id}
        src={fallbackUrl}
        className={classes.media}
      />
    </picture>
    <HoverArea>
      <div
        id="media-controls"
        className={classes.mediaControls}
      >
        {children}
      </div>
    </HoverArea>
  </React.Fragment>;
}
