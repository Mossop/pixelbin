import { useLocalization } from "@fluent/react";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import React, { useCallback } from "react";

import { Album, Reference } from "../api/highlevel";
import { UserState } from "../api/types";
import Content from "../components/Content";
import Page from "../components/Page";
import { useActions } from "../store/actions";
import { ReactResult } from "../utils/types";

export interface AlbumPageProps {
  album: Reference<Album>;
  user: UserState;
}

export default function AlbumPage(props: AlbumPageProps): ReactResult {
  const { l10n } = useLocalization();
  const actions = useActions();

  const onAlbumEdit = useCallback(
    () => actions.showAlbumEditOverlay(props.album),
    [actions, props],
  );

  const onAlbumCreate = useCallback(
    () => actions.showAlbumCreateOverlay(props.album),
    [props, actions],
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
      <Typography variant="h1">Album</Typography>
    </Content>
  </Page>;
}
