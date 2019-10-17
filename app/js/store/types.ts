import { ServerState, Catalog, Album } from "../api/types";
import { HistoryState } from "../utils/history";

export enum OverlayType {
  Login = "login",
  Signup = "signup",
  CreateCatalog = "createCatalog",
  Upload = "upload",
  EditCatalog = "editCatalog",
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

export type Overlay = BaseOverlay | UploadOverlay | CatalogEditOverlay;

export interface StoreState {
  serverState: ServerState;
  overlay?: Overlay;
  historyState: HistoryState | null;
}
