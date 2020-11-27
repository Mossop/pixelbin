import type { AlbumCreateOverlayProps, AlbumEditOverlayProps } from "./Album";
import type { AlbumDeleteOverlayProps } from "./AlbumDelete";
import type { CatalogEditOverlayProps } from "./CatalogEdit";
import type { SavedSearchCreateOverlayProps, SavedSearchEditOverlayProps } from "./SavedSearch";
import type { SavedSearchDeleteOverlayProps } from "./SavedSearchDelete";
import type { SearchOverlayProps } from "./Search";

export enum OverlayType {
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

interface BaseOverlayState {
  readonly type: OverlayType.Login | OverlayType.Signup | OverlayType.CatalogCreate;
}

type CatalogEditOverlayState = CatalogEditOverlayProps & {
  readonly type: OverlayType.CatalogEdit;
};

type AlbumCreateOverlayState = AlbumCreateOverlayProps & {
  readonly type: OverlayType.AlbumCreate;
};

type AlbumEditOverlayState = AlbumEditOverlayProps & {
  readonly type: OverlayType.AlbumEdit;
};

type AlbumDeleteOverlayState = AlbumDeleteOverlayProps & {
  readonly type: OverlayType.AlbumDelete;
};

type SearchOverlayState = SearchOverlayProps & {
  readonly type: OverlayType.Search;
};

type SavedSearchCreateOverlayState = SavedSearchCreateOverlayProps & {
  readonly type: OverlayType.SavedSearchCreate;
};

type SaveSearchEditOverlayState = SavedSearchEditOverlayProps & {
  readonly type: OverlayType.SavedSearchEdit;
};

type SavedSearchDeleteOverlayState = SavedSearchDeleteOverlayProps & {
  readonly type: OverlayType.SavedSearchDelete;
};

export type OverlayState =
   BaseOverlayState |
   CatalogEditOverlayState |
   AlbumCreateOverlayState |
   AlbumEditOverlayState |
   AlbumDeleteOverlayState |
   SearchOverlayState |
   SavedSearchCreateOverlayState |
   SaveSearchEditOverlayState |
   SavedSearchDeleteOverlayState;
