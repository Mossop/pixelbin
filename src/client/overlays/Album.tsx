import React, { useCallback, useRef, useState } from "react";

import { createAlbum, editAlbum } from "../api/album";
import { Album, Catalog, Reference, useCatalogs } from "../api/highlevel";
import { MediaTarget } from "../api/media";
import { AlbumState, Create, Patch } from "../api/types";
import { FormDialog, MediaTargetField, TextField, useFormState } from "../components/Forms";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { StoreState } from "../store/types";
import { AppError } from "../utils/exception";
import { ReactResult } from "../utils/types";
import { VirtualItem, VirtualTree } from "../utils/virtual";

export interface AlbumEditOverlayProps {
  readonly album: Reference<Album>;
}

export interface AlbumCreateOverlayProps {
  readonly parent: Reference<MediaTarget>;
}

export type AlbumOverlayProps = AlbumEditOverlayProps | AlbumCreateOverlayProps;

export default function AlbumOverlay(props: AlbumOverlayProps): ReactResult {
  let { album, parent, catalog } = useSelector((state: StoreState) => {
    let album: Album | null = null;
    let catalog: Catalog;
    let parent: Album | Catalog;

    if ("album" in props) {
      album = props.album.deref(state.serverState);
      catalog = album.catalog;
      parent = album.parent ?? catalog;
    } else {
      parent = props.parent.deref(state.serverState);
      catalog = parent instanceof Catalog ? parent : parent.catalog;
    }

    return {
      album,
      catalog,
      parent,
    };
  });

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

  let catalogs = useCatalogs().map(
    (catalog: Catalog): VirtualItem => catalog.virtual(VirtualTree.Albums),
  );

  let roots = album ? [album.catalog.virtual(VirtualTree.Albums)] : catalogs;

  let onSubmit = useCallback(async () => {
    let { name, parent } = state.value;
    if (!name) {
      return;
    }

    setDisabled(true);
    setError(null);

    try {
      if (!album) {
        let data: Create<AlbumState> = {
          catalog: catalog.ref(),
          name: name,
          parent: parent instanceof Catalog ? null : parent.ref(),
        };

        let albumData = await createAlbum(data);
        actions.albumCreated(albumData);
      } else {
        let updated: Patch<AlbumState> = {
          id: album.ref(),
          name: name,
          parent: parent instanceof Catalog ? null : parent.ref(),
        };

        let albumData = await editAlbum(updated);
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
    onClose={actions.closeOverlay}
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
      roots={roots}
    />
  </FormDialog>;
}
