import { Action } from "history";

import { ServerData } from "../api/types";
import { Immutable } from "../utils/immer";

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
  readonly target: string | undefined;
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
}

export type OverlayState = BaseOverlayState | UploadOverlayState | CatalogEditOverlayState | AlbumCreateOverlayState | AlbumEditOverlayState;

interface Settings {
  readonly thumbnailSize: number;
}

export type LocationState = undefined;

export interface HistoryState {
  readonly url: URL;
  readonly state: LocationState;
  readonly length: number;
  readonly action: Action;
}

export interface StoreState {
  readonly serverState: Immutable<ServerData>;
  readonly overlay?: OverlayState;
  readonly settings: Settings;
  readonly historyState: HistoryState | null;
  readonly stateId: number;
}
