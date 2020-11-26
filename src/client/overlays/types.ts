import type { AlbumCreateOverlayProps, AlbumEditOverlayProps } from "./Album";
import type { AlbumDeleteOverlayProps } from "./AlbumDelete";
import type { CatalogEditOverlayProps } from "./CatalogEdit";
import type { SaveSearchOverlayProps } from "./SaveSearch";
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
  SaveSearch = "saveSearch",
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

type SaveSearchOverlayState = SaveSearchOverlayProps & {
  readonly type: OverlayType.SaveSearch;
};

export type OverlayState =
   BaseOverlayState |
   CatalogEditOverlayState |
   AlbumCreateOverlayState |
   AlbumEditOverlayState |
   AlbumDeleteOverlayState |
   SearchOverlayState |
   SaveSearchOverlayState;