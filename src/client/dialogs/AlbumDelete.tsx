import { useCallback, useState } from "react";

import { deleteAlbum } from "../api/album";
import type { Reference } from "../api/highlevel";
import { Album, useReference } from "../api/highlevel";
import ConfirmationDialog from "../components/Forms/ConfirmationDialog";
import { Text } from "../components/Text";
import { useActions } from "../store/actions";
import type { AppError } from "../utils/exception";
import type { ReactResult } from "../utils/types";

export interface AlbumDeleteDialogProps {
  readonly album: Reference<Album>;
}

export default function AlbumDeleteDialog({
  album: albumRef,
}: AlbumDeleteDialogProps): ReactResult {
  let album = useReference(Album, albumRef);

  let [disabled, setDisabled] = useState(false);
  let [error, setError] = useState<AppError | null>(null);

  let actions = useActions();

  let onAccept = useCallback(async () => {
    setDisabled(true);
    setError(null);

    try {
      await deleteAlbum(albumRef);
      actions.albumDeleted(albumRef);
    } catch (e) {
      setError(e);
      setDisabled(false);
    }
  }, [albumRef, actions]);

  return <ConfirmationDialog
    error={error}
    disabled={disabled}
    titleId="album-delete-title"
    onAccept={onAccept}
    onClose={actions.closeDialog}
  >
    <Text l10nId="album-delete-description" l10nVars={{ name: album.name }}/>
  </ConfirmationDialog>;
}
