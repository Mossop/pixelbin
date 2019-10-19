import { ServerState, Catalog, Album } from "../api/types";
import { HistoryState } from "../utils/history";

export enum OverlayType {
  Login = "login",
  Signup = "signup",
  CreateCatalog = "createCatalog",
  EditCatalog = "editCatalog",
  CreateAlbum = "createAlbum",
  EditAlbum = "editAlbum",
  Upload = "upload",
}

interface BaseOverlayState {
  readonly type: OverlayType.Login | OverlayType.Signup | OverlayType.CreateCatalog;
}

interface UploadOverlayState {
  readonly type: OverlayType.Upload;
  readonly catalog?: Catalog;
  readonly parent?: Album;
}

interface CatalogEditOverlayState {
  readonly type: OverlayType.EditCatalog;
  readonly catalog: Catalog;
}

interface AlbumCreateOverlayState {
  readonly type: OverlayType.CreateAlbum;
  readonly catalog: Catalog;
  readonly parent?: Album;
}

interface AlbumEditOverlayState {
  readonly type: OverlayType.EditAlbum;
  readonly catalog: Catalog;
  readonly album: Album;
}

export type OverlayState = BaseOverlayState | UploadOverlayState | CatalogEditOverlayState | AlbumCreateOverlayState | AlbumEditOverlayState;

export interface StoreState {
  readonly serverState: ServerState;
  readonly overlay?: OverlayState;
  readonly historyState: HistoryState | null;
}
