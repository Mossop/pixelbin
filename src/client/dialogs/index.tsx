import { lazy } from "react";

import { useSelector, useUserState } from "../store";
import { useActions } from "../store/actions";
import type { StoreState } from "../store/types";
import type { ReactResult } from "../utils/types";
import type { DialogState } from "./types";
import { DialogType } from "./types";

const LoginDialog = lazy(() => import(/* webpackChunkName: "LoginDialog" */ "./Login"));
const AlbumDialog = lazy(() => import(/* webpackChunkName: "AlbumDialog" */ "./Album"));
const AlbumDeleteDialog = lazy(() =>
  import(/* webpackChunkName: "AlbumDeleteDialog" */ "./AlbumDelete"));
const CatalogCreateDialog = lazy(() =>
  import(/* webpackChunkName: "CatalogCreate" */ "./CatalogCreate"));
const CatalogEditDialog = lazy(() =>
  import(/* webpackChunkName: "CatalogEdit" */ "./CatalogEdit"));
const SignupDialog = lazy(() => import(/* webpackChunkName: "SignupDialog" */ "./Signup"));
const SearchDialog = lazy(() => import(/* webpackChunkName: "SearchDialog" */ "./Search"));
const SavedSearchDialog = lazy(() =>
  import(/* webpackChunkName: "SavedSearchDialog" */ "./SavedSearch"));
const SavedSearchDeleteDialog = lazy(() =>
  import(/* webpackChunkName: "SavedSearchDeleteDialog" */ "./SavedSearchDelete"));

function dialogSelector(state: StoreState): DialogState | undefined {
  return state.ui.dialog;
}

export default function Dialog(): ReactResult {
  let actions = useActions();

  let user = useUserState();
  let dialog = useSelector(dialogSelector);

  if (!dialog) {
    return null;
  }

  if (user) {
    switch (dialog.type) {
      case DialogType.CatalogCreate: {
        return <CatalogCreateDialog user={user}/>;
      }
      case DialogType.CatalogEdit: {
        return <CatalogEditDialog {...dialog}/>;
      }
      case DialogType.AlbumCreate: {
        return <AlbumDialog {...dialog}/>;
      }
      case DialogType.AlbumEdit: {
        return <AlbumDialog {...dialog}/>;
      }
      case DialogType.AlbumDelete: {
        return <AlbumDeleteDialog {...dialog}/>;
      }
      case DialogType.Search: {
        return <SearchDialog {...dialog}/>;
      }
      case DialogType.SavedSearchCreate: {
        return <SavedSearchDialog {...dialog}/>;
      }
      case DialogType.SavedSearchEdit: {
        return <SavedSearchDialog {...dialog}/>;
      }
      case DialogType.SavedSearchDelete: {
        return <SavedSearchDeleteDialog {...dialog}/>;
      }
    }
  }

  switch (dialog.type) {
    case DialogType.Login: {
      return <LoginDialog/>;
    }
    case DialogType.Signup: {
      return <SignupDialog/>;
    }
  }

  console.error(`State contained an illegal dialog: ${dialog.type}`);
  actions.closeDialog();
  return null;
}
