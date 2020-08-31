import { Reference, Album, Catalog } from "../api/highlevel";
import { MediaTarget } from "../api/media";

export enum OverlayType {
  Login = "login",
  Signup = "signup",
  CreateCatalog = "createCatalog",
  EditCatalog = "editCatalog",
  CreateAlbum = "createAlbum",
  EditAlbum = "editAlbum",
}

interface BaseOverlayState {
  readonly type: OverlayType.Login | OverlayType.Signup | OverlayType.CreateCatalog;
}

interface CatalogEditOverlayState {
  readonly type: OverlayType.EditCatalog;
  readonly catalog: Reference<Catalog>;
}

interface AlbumCreateOverlayState {
  readonly type: OverlayType.CreateAlbum;
  readonly parent: Reference<MediaTarget>;
}

interface AlbumEditOverlayState {
  readonly type: OverlayType.EditAlbum;
  readonly album: Reference<Album>;
}

export type OverlayState =
   BaseOverlayState |
   CatalogEditOverlayState |
   AlbumCreateOverlayState |
   AlbumEditOverlayState;
