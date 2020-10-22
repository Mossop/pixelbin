import type { AlbumCreateOverlayProps, AlbumEditOverlayProps } from "./Album";
import type { CatalogEditOverlayProps } from "./CatalogEdit";
import type { SearchOverlayProps } from "./Search";

export enum OverlayType {
  Login = "login",
  Signup = "signup",
  CatalogCreate = "createCatalog",
  CatalogEdit = "editCatalog",
  AlbumCreate = "createAlbum",
  AlbumEdit = "editAlbum",
  Search = "search",
}

interface BaseOverlayState {
  readonly type: OverlayType.Login | OverlayType.Signup | OverlayType.CatalogCreate;
}

type CaalogEditOverlayState = CatalogEditOverlayProps & {
  readonly type: OverlayType.CatalogEdit;
};

type AlbumCreateOverlayState = AlbumCreateOverlayProps & {
  readonly type: OverlayType.AlbumCreate;
};

type AlbumEditOverlayState = AlbumEditOverlayProps & {
  readonly type: OverlayType.AlbumEdit;
};

type SearchOverlayState = SearchOverlayProps & {
  readonly type: OverlayType.Search;
};

export type OverlayState =
   BaseOverlayState |
   CaalogEditOverlayState |
   AlbumCreateOverlayState |
   AlbumEditOverlayState |
   SearchOverlayState;
