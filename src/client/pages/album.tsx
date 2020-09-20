import { useLocalization } from "@fluent/react";
import React, { useCallback, useEffect } from "react";

import { Album, Reference } from "../api/highlevel";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { MediaLookupType, StoreState } from "../store/types";
import { ReactResult } from "../utils/types";
import { AuthenticatedPageProps } from "./types";

export interface AlbumPageProps {
  readonly album: Reference<Album>;
}

export default function AlbumPage(props: AlbumPageProps & AuthenticatedPageProps): ReactResult {
  const { l10n } = useLocalization();
  const actions = useActions();
  const media = useSelector((state: StoreState) => state.mediaList?.media);

  const onAlbumEdit = useCallback(
    () => actions.showAlbumEditOverlay(props.album),
    [actions, props.album],
  );

  const onAlbumCreate = useCallback(
    () => actions.showAlbumCreateOverlay(props.album),
    [props.album, actions],
  );

  useEffect(
    () => actions.listMedia({
      type: MediaLookupType.Album,
      album: props.album,
      recursive: true,
    }),
    [props.album, actions],
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
      <MediaGallery media={media}/>
    </Content>
  </Page>;
}
