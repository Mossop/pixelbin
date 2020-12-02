import type { AlbumCreateDialogProps, AlbumEditDialogProps } from "./Album";
import type { AlbumDeleteDialogProps } from "./AlbumDelete";
import type { CatalogEditDialogProps } from "./CatalogEdit";
import type { SavedSearchCreateDialogProps, SavedSearchEditDialogProps } from "./SavedSearch";
import type { SavedSearchDeleteDialogProps } from "./SavedSearchDelete";
import type { SearchDialogProps } from "./Search";

export enum DialogType {
  Login = "login",
  Signup = "signup",
  CatalogCreate = "createCatalog",
  CatalogEdit = "editCatalog",
  AlbumCreate = "createAlbum",
  AlbumEdit = "editAlbum",
  AlbumDelete = "deleteAlbum",
  Search = "search",
  SavedSearchCreate = "createSavedSearch",
  SavedSearchEdit = "editSavedSearch",
  SavedSearchDelete = "deleteSavedSearch",
}

interface BaseDialogState {
  readonly type: DialogType.Login | DialogType.Signup | DialogType.CatalogCreate;
}

type CatalogEditDialogState = CatalogEditDialogProps & {
  readonly type: DialogType.CatalogEdit;
};

type AlbumCreateDialogState = AlbumCreateDialogProps & {
  readonly type: DialogType.AlbumCreate;
};

type AlbumEditDialogState = AlbumEditDialogProps & {
  readonly type: DialogType.AlbumEdit;
};

type AlbumDeleteDialogState = AlbumDeleteDialogProps & {
  readonly type: DialogType.AlbumDelete;
};

type SearchDialogState = SearchDialogProps & {
  readonly type: DialogType.Search;
};

type SavedSearchCreateDialogState = SavedSearchCreateDialogProps & {
  readonly type: DialogType.SavedSearchCreate;
};

type SaveSearchEditDialogState = SavedSearchEditDialogProps & {
  readonly type: DialogType.SavedSearchEdit;
};

type SavedSearchDeleteDialogState = SavedSearchDeleteDialogProps & {
  readonly type: DialogType.SavedSearchDelete;
};

export type DialogState =
   BaseDialogState |
   CatalogEditDialogState |
   AlbumCreateDialogState |
   AlbumEditDialogState |
   AlbumDeleteDialogState |
   SearchDialogState |
   SavedSearchCreateDialogState |
   SaveSearchEditDialogState |
   SavedSearchDeleteDialogState;
