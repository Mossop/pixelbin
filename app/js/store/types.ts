import { ServerState, Catalog, Album } from "../api/types";
import { HistoryState } from "../utils/history";

export enum OverlayType {
  Login = "login",
  Signup = "signup",
  CreateCatalog = "createCatalog",
  EditCatalog = "editCatalog",
  CreateAlbum = "createAlbum",
  Upload = "upload",
}

interface BaseOverlay {
  type: OverlayType.Login | OverlayType.Signup | OverlayType.CreateCatalog;
}

interface UploadOverlay {
  type: OverlayType.Upload;
  catalog?: Catalog;
  album?: Album;
}

interface CatalogEditOverlay {
  type: OverlayType.EditCatalog;
  catalog: Catalog;
}

interface AlbumCreateOverlay {
  type: OverlayType.CreateAlbum;
  catalog: Catalog;
  album?: Album;
}

export type Overlay = BaseOverlay | UploadOverlay | CatalogEditOverlay | AlbumCreateOverlay;

export interface StoreState {
  serverState: ServerState;
  overlay?: Overlay;
  historyState: HistoryState | null;
}
