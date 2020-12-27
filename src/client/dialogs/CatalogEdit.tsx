import { useState, useRef, useCallback } from "react";

import { editCatalog } from "../api/catalog";
import type { Reference } from "../api/highlevel";
import { Catalog, useReference } from "../api/highlevel";
import { FormDialog, TextField, useFormState } from "../components/Forms";
import { useActions } from "../store/actions";
import type { AppError } from "../utils/exception";
import type { ReactResult } from "../utils/types";

export interface CatalogEditDialogProps {
  readonly catalog: Reference<Catalog>;
}

export default function CatalogEditDialog({
  catalog: catalogRef,
}: CatalogEditDialogProps): ReactResult {
  let catalog = useReference(Catalog, catalogRef);

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
      let catalogData = await editCatalog(catalogRef, {
        name,
      });
      actions.catalogEdited(catalogData);
    } catch (e) {
      setError(e);
      setDisabled(false);
      nameInput.current?.focus();
    }
  }, [actions, state, catalogRef]);

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
