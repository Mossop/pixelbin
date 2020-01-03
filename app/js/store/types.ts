import { ServerState } from "../api/types";
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
  readonly parent: string;
}

interface CatalogEditOverlayState {
  readonly type: OverlayType.EditCatalog;
  readonly catalog: string;
}

interface AlbumCreateOverlayState {
  readonly type: OverlayType.CreateAlbum;
  readonly parent: string;
}

interface AlbumEditOverlayState {
  readonly type: OverlayType.EditAlbum;
  readonly album: string;
  readonly parent: string;
}

export type OverlayState = BaseOverlayState | UploadOverlayState | CatalogEditOverlayState | AlbumCreateOverlayState | AlbumEditOverlayState;

interface Settings {
  readonly thumbnailSize: number;
}

export interface StoreState {
  readonly serverState: ServerState;
  readonly overlay?: OverlayState;
  readonly settings: Settings;
  readonly historyState: HistoryState | null;
  readonly stateId: number;
}
