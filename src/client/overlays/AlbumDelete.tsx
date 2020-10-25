import { Localized } from "@fluent/react";
import Typography from "@material-ui/core/Typography";
import React, { useCallback, useState } from "react";

import { deleteAlbum } from "../api/album";
import { Album, Reference } from "../api/highlevel";
import ConfirmationDialog from "../components/Forms/ConfirmationDialog";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { StoreState } from "../store/types";
import { AppError } from "../utils/exception";
import { ReactResult } from "../utils/types";

export interface AlbumDeleteOverlayProps {
  readonly album: Reference<Album>;
}

export default function AlbumDeleteOverlay(props: AlbumDeleteOverlayProps): ReactResult {
  let album = useSelector((state: StoreState) => {
    return props.album.deref(state.serverState);
  });

  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const actions = useActions();

  const onAccept = useCallback(async () => {
    setDisabled(true);
    setError(null);

    try {
      await deleteAlbum(props.album);
      actions.albumDeleted(props.album);
    } catch (e) {
      setError(e);
      setDisabled(false);
    }
  }, [props.album, actions]);

  return <ConfirmationDialog
    error={error}
    disabled={disabled}
    titleId="album-delete-title"
    onAccept={onAccept}
    onClose={actions.closeOverlay}
  >
    <Localized id="album-delete-description" vars={{ name: album.name }}>
      <Typography variant="body1"/>
    </Localized>
  </ConfirmationDialog>;
}
