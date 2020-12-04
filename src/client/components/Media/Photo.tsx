import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import alpha from "color-alpha";
import React, { useMemo } from "react";

import type { Encoding, ProcessedMediaState } from "../../api/types";
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

  let { alternates, fallback } = useMemo(() => {
    let alternates: Encoding[] = [];
    let fallback: Encoding | null = null;

    for (let encoding of media.file.encodings) {
      if (encoding.mimetype == "image/jpeg") {
        fallback = encoding;
      } else {
        alternates.push(encoding);
      }
    }

    return {
      alternates,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fallback: fallback!,
    };
  }, [media]);

  return <React.Fragment>
    <picture>
      {
        alternates.map((encoding: Encoding) => <source
          key={encoding.mimetype}
          srcSet={encoding.url}
          type={encoding.mimetype}
        />)
      }
      <img
        id="media-fallback"
        key={media.id}
        src={fallback.url}
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
