import type { AlbumCreateOverlayProps, AlbumEditOverlayProps } from "./Album";
import type { CatalogEditOverlayProps } from "./EditCatalog";
import type { SearchOverlayProps } from "./Search";

export enum OverlayType {
  Login = "login",
  Signup = "signup",
  CreateCatalog = "createCatalog",
  EditCatalog = "editCatalog",
  CreateAlbum = "createAlbum",
  EditAlbum = "editAlbum",
  Search = "search",
}

interface BaseOverlayState {
  readonly type: OverlayType.Login | OverlayType.Signup | OverlayType.CreateCatalog;
}

type CaalogEditOverlayState = CatalogEditOverlayProps & {
  readonly type: OverlayType.EditCatalog;
};

type AlbumCreateOverlayState = AlbumCreateOverlayProps & {
  readonly type: OverlayType.CreateAlbum;
};

type AlbumEditOverlayState = AlbumEditOverlayProps & {
  readonly type: OverlayType.EditAlbum;
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
