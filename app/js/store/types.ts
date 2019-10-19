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

interface BaseOverlay {
  readonly type: OverlayType.Login | OverlayType.Signup | OverlayType.CreateCatalog;
}

interface UploadOverlay {
  readonly type: OverlayType.Upload;
  readonly catalog?: Catalog;
  readonly parent?: Album;
}

interface CatalogEditOverlay {
  readonly type: OverlayType.EditCatalog;
  readonly catalog: Catalog;
}

interface AlbumCreateOverlay {
  readonly type: OverlayType.CreateAlbum;
  readonly catalog: Catalog;
  readonly parent?: Album;
}

interface AlbumEditOverlay {
  readonly type: OverlayType.EditAlbum;
  readonly catalog: Catalog;
  readonly album: Album;
}

export type Overlay = BaseOverlay | UploadOverlay | CatalogEditOverlay | AlbumCreateOverlay | AlbumEditOverlay;

export interface StoreState {
  readonly serverState: ServerState;
  readonly overlay?: Overlay;
  readonly historyState: HistoryState | null;
}
