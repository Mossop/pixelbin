import React, { useCallback, useRef, useState } from "react";

import type { Query } from "../../model";
import type { Catalog, Reference } from "../api/highlevel";
import { createSavedSearch } from "../api/search";
import { FormDialog, Radio, RadioGroup, TextField, useFormState } from "../components/Forms";
import { useActions } from "../store/actions";
import type { AppError } from "../utils/exception";
import type { ReactResult } from "../utils/types";

export interface SaveSearchOverlayProps {
  catalog: Reference<Catalog>;
  query: Query;
}

export default function SaveSearchOverlay({
  catalog,
  query,
}: SaveSearchOverlayProps): ReactResult {
  let state = useFormState({
    name: "",
    shared: false,
  });
  let [disabled, setDisabled] = useState(false);
  let [error, setError] = useState<AppError | null>(null);

  let actions = useActions();
  let nameInput = useRef<HTMLElement>(null);

  let onDisplay = useCallback(() => {
    nameInput.current?.focus();
  }, [nameInput]);

  let onSubmit = useCallback(async () => {
    let { name, shared } = state.value;
    if (!name) {
      return;
    }

    setDisabled(true);
    setError(null);

    try {
      let newSearch = await createSavedSearch(catalog, query, name, shared);
      actions.searchSaved(newSearch);
    } catch (e) {
      setError(e);
      setDisabled(false);
      nameInput.current?.focus();
    }
  }, [actions, state, catalog, query]);

  return <FormDialog
    id="save-search"
    error={error}
    disabled={disabled}
    titleId="save-search-title"
    submitId="save-search-submit"
    onSubmit={onSubmit}
    onClose={actions.closeOverlay}
    onEntered={onDisplay}
  >
    <TextField
      id="save-search-name"
      labelId="save-search-name"
      state={state.name}
      ref={nameInput}
    />
    <RadioGroup name="shared" state={state.shared}>
      <Radio id="save-search-private" labelId="save-search-private" value={false}/>
      <Radio id="save-search-public" labelId="save-search-public" value={true}/>
    </RadioGroup>
  </FormDialog>;
}
