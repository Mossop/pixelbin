import { useCallback, useRef, useState } from "react";
import { shallowEqual } from "react-redux";

import { createAlbum, editAlbum } from "../api/album";
import type { Reference } from "../api/highlevel";
import { Album, deref, Catalog, useCatalogs } from "../api/highlevel";
import type { MediaTarget } from "../api/media";
import { mediaTargetDeref } from "../api/media";
import { FormDialog, MediaTargetField, TextField, useFormState } from "../components/Forms";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import type { StoreState } from "../store/types";
import type { AppError } from "../utils/exception";
import type { ReactResult } from "../utils/types";

export interface AlbumEditDialogProps {
  readonly album: Reference<Album>;
}

export interface AlbumCreateDialogProps {
  readonly parent: Reference<MediaTarget>;
}

export type AlbumDialogProps = AlbumEditDialogProps | AlbumCreateDialogProps;

export default function AlbumDialog(props: AlbumDialogProps): ReactResult {
  let { album, parent, catalog } = useSelector(
    useCallback((state: StoreState) => {
      let album: Album | null = null;
      let catalog: Catalog;
      let parent: Album | Catalog;

      if ("album" in props) {
        album = deref(Album, props.album, state.serverState);
        catalog = album.catalog;
        parent = album.parent ?? catalog;
      } else {
        parent = mediaTargetDeref(props.parent, state.serverState);
        catalog = parent instanceof Catalog ? parent : parent.catalog;
      }

      return {
        album,
        catalog,
        parent,
      };
    }, [props]),
    shallowEqual,
  );

  let state = useFormState({
    name: album?.name ?? "",
    parent,
  });
  let [disabled, setDisabled] = useState(false);
  let [error, setError] = useState<AppError | null>(null);

  let actions = useActions();
  let nameInput = useRef<HTMLElement>(null);

  let onDisplay = useCallback(() => {
    nameInput.current?.focus();
  }, [nameInput]);

  let catalogs = useCatalogs();
  if (album) {
    catalogs = [album.catalog];
  }

  let onSubmit = useCallback(async () => {
    let { name, parent } = state.value;
    if (!name) {
      return;
    }

    setDisabled(true);
    setError(null);

    try {
      if (!album) {
        let albumData = await createAlbum(catalog.ref(), {
          name: name,
          parent: parent instanceof Catalog ? null : parent.ref(),
        });

        actions.albumCreated(albumData);
      } else {
        let albumData = await editAlbum(album.ref(), {
          name: name,
          parent: parent instanceof Catalog ? null : parent.ref(),
        });

        actions.albumEdited(albumData);
      }
    } catch (e) {
      setError(e);
      setDisabled(false);
      nameInput.current?.focus();
    }
  }, [album, actions, catalog, state]);

  return <FormDialog
    id={album ? "album-edit" : "album-create"}
    error={error}
    disabled={disabled}
    titleId={album ? "album-edit-title" : "album-create-title"}
    submitId={album ? "album-edit-submit" : "album-create-submit"}
    onSubmit={onSubmit}
    onClose={actions.closeDialog}
    onEntered={onDisplay}
  >
    <TextField
      id="album-name"
      labelId="album-name"
      state={state.name}
      ref={nameInput}
    />
    <MediaTargetField
      id="album-parent"
      labelId={album ? "album-edit-parent" : "album-create-parent"}
      state={state.parent}
      catalogs={catalogs}
      currentTarget={album?.id}
    />
  </FormDialog>;
}
