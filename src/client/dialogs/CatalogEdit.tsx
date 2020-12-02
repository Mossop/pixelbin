import React, { useState, useRef, useCallback } from "react";
import { useSelector } from "react-redux";

import { editCatalog } from "../api/catalog";
import type { Catalog, Reference } from "../api/highlevel";
import { FormDialog, TextField, useFormState } from "../components/Forms";
import { useActions } from "../store/actions";
import type { StoreState } from "../store/types";
import type { AppError } from "../utils/exception";
import type { ReactResult } from "../utils/types";

export interface CatalogEditDialogProps {
  readonly catalog: Reference<Catalog>;
}

export default function CatalogEditDialog(props: CatalogEditDialogProps): ReactResult {
  let catalog = useSelector((state: StoreState) => {
    return props.catalog.deref(state.serverState);
  });

  let state = useFormState({
    name: catalog.name,
  });
  let [disabled, setDisabled] = useState(false);
  let [error, setError] = useState<AppError | null>(null);

  let actions = useActions();
  let nameInput = useRef<HTMLElement>(null);

  let onDisplay = useCallback(() => {
    nameInput.current?.focus();
  }, [nameInput]);

  let onSubmit = useCallback(async () => {
    let { name } = state.value;
    if (!name) {
      return;
    }

    setDisabled(true);
    setError(null);

    try {
      let catalogData = await editCatalog(props.catalog, {
        name,
      });
      actions.catalogEdited(catalogData);
    } catch (e) {
      setError(e);
      setDisabled(false);
      nameInput.current?.focus();
    }
  }, [actions, state, props.catalog]);

  return <FormDialog
    id="catalog-edit"
    error={error}
    disabled={disabled}
    titleId="catalog-edit-title"
    submitId="catalog-edit-submit"
    onSubmit={onSubmit}
    onClose={actions.closeDialog}
    onEntered={onDisplay}
  >
    <TextField
      id="catalog-name"
      labelId="catalog-name"
      state={state.name}
      ref={nameInput}
    />
  </FormDialog>;
}
