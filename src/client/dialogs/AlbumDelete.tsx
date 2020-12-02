import { Localized } from "@fluent/react";
import Typography from "@material-ui/core/Typography";
import React, { useCallback, useState } from "react";

import { deleteAlbum } from "../api/album";
import type { Album, Reference } from "../api/highlevel";
import ConfirmationDialog from "../components/Forms/ConfirmationDialog";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import type { StoreState } from "../store/types";
import type { AppError } from "../utils/exception";
import type { ReactResult } from "../utils/types";

export interface AlbumDeleteDialogProps {
  readonly album: Reference<Album>;
}

export default function AlbumDeleteDialog(props: AlbumDeleteDialogProps): ReactResult {
  let album = useSelector((state: StoreState) => {
    return props.album.deref(state.serverState);
  });

  let [disabled, setDisabled] = useState(false);
  let [error, setError] = useState<AppError | null>(null);

  let actions = useActions();

  let onAccept = useCallback(async () => {
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
    onClose={actions.closeDialog}
  >
    <Localized id="album-delete-description" vars={{ name: album.name }}>
      <Typography variant="body1"/>
    </Localized>
  </ConfirmationDialog>;
}
