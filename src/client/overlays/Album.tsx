import React, { useCallback, useRef, useState } from "react";

import { createAlbum, editAlbum } from "../api/album";
import { Album, Catalog, Reference, useCatalogs } from "../api/highlevel";
import { MediaTarget } from "../api/media";
import { AlbumState, Create, Patch } from "../api/types";
import FormFields from "../components/FormFields";
import { FormDialog } from "../components/Forms";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { StoreState } from "../store/types";
import { AppError } from "../utils/exception";
import { useFormState } from "../utils/hooks";
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

  let [state, setState] = useFormState({
    name: album?.name ?? "",
    parent,
  });
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const actions = useActions();
  const nameInput = useRef<HTMLElement>(null);

  const onDisplay = useCallback(() => {
    nameInput.current?.focus();
  }, [nameInput]);

  const catalogs = useCatalogs().map(
    (catalog: Catalog): VirtualItem => catalog.virtual(VirtualTree.Albums),
  );

  let roots = album ? [album.catalog.virtual(VirtualTree.Albums)] : catalogs;

  const onSubmit = useCallback(async () => {
    if (!state.name) {
      return;
    }

    setDisabled(true);
    setError(null);

    try {
      if (!album) {
        let data: Create<AlbumState> = {
          catalog: catalog.ref(),
          name: state.name,
          parent: state.parent instanceof Catalog ? null : state.parent.ref(),
        };

        let albumData = await createAlbum(data);
        actions.albumCreated(albumData);
      } else {
        let updated: Patch<AlbumState> = {
          id: album.ref(),
          name: state.name,
          parent: state.parent instanceof Catalog ? null : state.parent.ref(),
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
    id="form-dialog"
    error={error}
    disabled={disabled}
    titleId={album ? "album-edit-title" : "album-create-title"}
    submitId={album ? "album-edit-submit" : "album-create-submit"}
    onSubmit={onSubmit}
    onClose={actions.closeOverlay}
    onEntered={onDisplay}
  >
    <FormFields
      id="form-dialog"
      disabled={disabled}
      state={state}
      setState={setState}
      fields={
        [{
          type: "text",
          key: "name",
          label: "album-name",
          ref: nameInput,
        }, {
          type: "mediatarget",
          key: "parent",
          label: album ? "album-edit-parent" : "album-create-parent",
          roots,
        }]
      }
    />
  </FormDialog>;
}
