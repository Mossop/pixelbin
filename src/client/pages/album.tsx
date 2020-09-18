import { useLocalization } from "@fluent/react";
import React, { useCallback, useEffect } from "react";

import { listAlbumMedia } from "../api/album";
import { Album, Reference } from "../api/highlevel";
import { MediaState } from "../api/types";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import { useActions } from "../store/actions";
import MediaManager from "../utils/MediaManager";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps } from "./types";

export interface AlbumPageProps {
  readonly album: Reference<Album>;
  readonly media?: readonly MediaState[];
}

export default function AlbumPage(props: AlbumPageProps & AuthenticatedPageProps): ReactResult {
  const { l10n } = useLocalization();
  const actions = useActions();

  const onAlbumEdit = useCallback(
    () => actions.showAlbumEditOverlay(props.album),
    [actions, props.album],
  );

  const onAlbumCreate = useCallback(
    () => actions.showAlbumCreateOverlay(props.album),
    [props.album, actions],
  );

  let listMedia = useCallback(() => listAlbumMedia(props.album, true), [props.album]);
  useEffect(
    () => MediaManager.requestMediaList(listMedia, actions.listedMedia),
    [listMedia, actions],
  );

  return <Page
    selectedItem={props.album.id}
    pageOptions={
      [{
        id: "album-edit",
        onClick: onAlbumEdit,
        label: l10n.getString("banner-album-edit"),
      }, {
        id: "album-create",
        onClick: onAlbumCreate,
        label: l10n.getString("banner-album-new"),
      }]
    }
  >
    <Content>
      <MediaGallery media={props.media}/>
    </Content>
  </Page>;
}
