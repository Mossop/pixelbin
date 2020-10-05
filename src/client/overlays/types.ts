import type { AlbumCreateOverlayProps, AlbumEditOverlayProps } from "./album";
import type { SearchOverlayProps } from "./search";

export enum OverlayType {
  Login = "login",
  Signup = "signup",
  CreateCatalog = "createCatalog",
  CreateAlbum = "createAlbum",
  EditAlbum = "editAlbum",
  Search = "search",
}

interface BaseOverlayState {
  readonly type: OverlayType.Login | OverlayType.Signup | OverlayType.CreateCatalog;
}

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
   AlbumCreateOverlayState |
   AlbumEditOverlayState |
   SearchOverlayState;
