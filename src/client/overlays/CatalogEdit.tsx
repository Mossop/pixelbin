import React, { useState, useRef, useCallback } from "react";
import { useSelector } from "react-redux";

import { editCatalog } from "../api/catalog";
import { Catalog, Reference } from "../api/highlevel";
import FormDialog from "../components/FormDialog";
import FormFields from "../components/FormFields";
import { useActions } from "../store/actions";
import { StoreState } from "../store/types";
import { AppError } from "../utils/exception";
import { useFormState } from "../utils/hooks";
import { ReactResult } from "../utils/types";

export interface CatalogEditOverlayProps {
  readonly catalog: Reference<Catalog>;
}

export default function CatalogEditOverlay(props: CatalogEditOverlayProps): ReactResult {
  let catalog = useSelector((state: StoreState) => {
    return props.catalog.deref(state.serverState);
  });

  let [state, setState] = useFormState({
    name: catalog.name,
  });
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const actions = useActions();
  const nameInput = useRef<HTMLElement>(null);

  const onDisplay = useCallback(() => {
    nameInput.current?.focus();
  }, [nameInput]);

  const onSubmit = useCallback(async () => {
    if (!state.name) {
      return;
    }

    setDisabled(true);
    setError(null);

    try {
      let catalogData = await editCatalog(props.catalog, state.name);
      actions.catalogEdited(catalogData);
    } catch (e) {
      setError(e);
      setDisabled(false);
      nameInput.current?.focus();
    }
  }, [actions, state, props.catalog]);

  return <FormDialog
    error={error}
    disabled={disabled}
    titleId="catalog-edit-title"
    submitId="catalog-edit-submit"
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
          label: "catalog-name",
          ref: nameInput,
        }]
      }
    /></FormDialog>;
}
