import { createStyles, makeStyles } from "@material-ui/core/styles";
import React, { useEffect, useMemo } from "react";

import { isProcessed, MediaState } from "../api/types";
import Content from "../components/Content";
import Loading from "../components/Loading";
import Page from "../components/Page";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { MediaLookup, MediaLookupType, StoreState } from "../store/types";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps } from "./types";

const useStyles = makeStyles(() =>
  createStyles({
    original: {
      flexGrow: 1,
      objectPosition: "center center",
      objectFit: "contain",
    },
  }));

export interface MediaPageProps {
  readonly media: string;
  readonly lookup: MediaLookup | null;
}

export default function MediaPage(props: MediaPageProps & AuthenticatedPageProps): ReactResult {
  const actions = useActions();
  const classes = useStyles();

  const mediaList = useSelector((state: StoreState) => state.mediaList?.media);

  useEffect(
    () => {
      actions.listMedia(props.lookup ?? {
        type: MediaLookupType.Single,
        media: props.media,
      });
    },
    [props.lookup, props.media, actions],
  );

  const media = useMemo(
    () => mediaList?.find((item: MediaState): boolean => item.id == props.media),
    [props.media, mediaList],
  );

  if (!mediaList) {
    return <Page>
      <Loading flexGrow={1}/>
    </Page>;
  }

  if (!media) {
    return <Page>
      <Loading flexGrow={1}/>
    </Page>;
  }

  if (!isProcessed(media)) {
    return <Page>
      <Loading flexGrow={1}/>
    </Page>;
  }

  return <Page>
    <Content>
      <img src={media.originalUrl} className={classes.original}/>
    </Content>
  </Page>;
}
