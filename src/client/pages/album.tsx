import { useLocalization } from "@fluent/react";
import Button from "@material-ui/core/Button";
import React, { useCallback, useEffect } from "react";

import { listAlbumMedia } from "../api/album";
import { UserState } from "../api/types";
import Content from "../components/Content";
import MediaGallery from "../components/MediaGallery";
import Page from "../components/Page";
import { useActions } from "../store/actions";
import MediaManager from "../utils/MediaManager";
import { ReactResult } from "../utils/types";
import { AlbumPageState } from "./types";

export type AlbumPageProps = AlbumPageState & {
  user: UserState;
};

export default function AlbumPage(props: AlbumPageProps): ReactResult {
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
    bannerButtons={
      <React.Fragment>
        <Button
          id="button-banner-album-edit"
          color="inherit"
          onClick={onAlbumEdit}
        >
          {l10n.getString("banner-album-edit")}
        </Button>
        <Button
          id="button-banner-album-create"
          color="inherit"
          onClick={onAlbumCreate}
        >
          {l10n.getString("banner-album-new")}
        </Button>
      </React.Fragment>
    }
  >
    <Content>
      <MediaGallery media={props.media}/>
    </Content>
  </Page>;
}
