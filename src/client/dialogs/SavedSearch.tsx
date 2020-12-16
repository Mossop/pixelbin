import { useCallback, useRef, useState } from "react";

import type { Query } from "../../model";
import type { Catalog, Reference, SavedSearch } from "../api/highlevel";
import { createSavedSearch, editSavedSearch } from "../api/search";
import { FormDialog, Radio, RadioGroup, TextField, useFormState } from "../components/Forms";
import { useSelector } from "../store";
import { useActions } from "../store/actions";
import type { StoreState } from "../store/types";
import type { AppError } from "../utils/exception";
import type { ReactResult } from "../utils/types";

export interface SavedSearchEditDialogProps {
  search: Reference<SavedSearch>;
}

export interface SavedSearchCreateDialogProps {
  catalog: Reference<Catalog>;
  query: Query;
}

export type SavedSearchDialogProps = SavedSearchCreateDialogProps | SavedSearchEditDialogProps;

export default function SavedSearchDialog(props: SavedSearchDialogProps): ReactResult {
  let { search, query, catalog } = useSelector((state: StoreState) => {
    let search: SavedSearch | null = null;
    let catalog: Catalog;
    let query: Query;

    if ("search" in props) {
      search = props.search.deref(state.serverState);
      catalog = search.catalog;
      query = search.query;
    } else {
      catalog = props.catalog.deref(state.serverState);
      query = props.query;
    }

    return {
      query,
      catalog,
      search,
    };
  });

  let state = useFormState({
    name: search?.name ?? "",
    shared: search?.shared ?? false,
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
      if (search) {
        let updatedSearch = await editSavedSearch(search.ref(), {
          name,
          shared,
        });
        actions.searchSaved(updatedSearch);
      } else {
        let newSearch = await createSavedSearch(catalog.ref(), {
          query,
          name,
          shared,
        });
        actions.searchSaved(newSearch);
      }
    } catch (e) {
      setError(e);
      setDisabled(false);
      nameInput.current?.focus();
    }
  }, [actions, state, catalog, query, search]);

  return <FormDialog
    id="saved-search"
    error={error}
    disabled={disabled}
    titleId={search ? "edit-saved-search-title" : "save-saved-search-title"}
    submitId="saved-search-submit"
    onSubmit={onSubmit}
    onClose={actions.closeDialog}
    onEntered={onDisplay}
  >
    <TextField
      id="saved-search-name"
      labelId="saved-search-name"
      state={state.name}
      ref={nameInput}
    />
    <RadioGroup name="shared" state={state.shared}>
      <Radio id="saved-search-private" labelId="saved-search-private" value={false}/>
      <Radio id="saved-search-public" labelId="saved-search-public" value={true}/>
    </RadioGroup>
  </FormDialog>;
}
