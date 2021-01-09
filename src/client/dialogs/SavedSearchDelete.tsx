import { useCallback, useState } from "react";

import type { Reference } from "../api/highlevel";
import { useReference, SavedSearch } from "../api/highlevel";
import { deleteSavedSearch } from "../api/search";
import ConfirmationDialog from "../components/Forms/ConfirmationDialog";
import { Text } from "../components/Text";
import { useActions } from "../store/actions";
import type { AppError } from "../utils/exception";
import type { ReactResult } from "../utils/types";

export interface SavedSearchDeleteDialogProps {
  readonly search: Reference<SavedSearch>;
}

export default function SavedSearchDeleteDialog(
  props: SavedSearchDeleteDialogProps,
): ReactResult {
  let search = useReference(SavedSearch, props.search);

  let [disabled, setDisabled] = useState(false);
  let [error, setError] = useState<AppError | null>(null);

  let actions = useActions();

  let onAccept = useCallback(async () => {
    setDisabled(true);
    setError(null);

    try {
      await deleteSavedSearch(props.search);
      actions.searchDeleted(props.search);
    } catch (e) {
      setError(e);
      setDisabled(false);
    }
  }, [props.search, actions]);

  return <ConfirmationDialog
    error={error}
    disabled={disabled}
    titleId="saved-search-delete-title"
    onAccept={onAccept}
    onClose={actions.closeDialog}
  >
    <Text l10nId="saved-search-delete-description" l10nVars={{ name: search.name }}/>
  </ConfirmationDialog>;
}
