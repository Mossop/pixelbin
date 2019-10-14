import { ServerState } from "./api";
import { HistoryState } from "../utils/history";

export enum OverlayType {
  Login,
  Signup,
  CreateCatalog,
  Upload,
}

interface BaseOverlay {
  type: OverlayType.Login | OverlayType.Signup | OverlayType.CreateCatalog;
}

interface UploadOverlay {
  type: OverlayType.Upload;
  catalog?: string;
  album?: string;
}

export type Overlay = BaseOverlay | UploadOverlay;

export interface StoreState {
  serverState: ServerState;
  overlay?: Overlay;
  historyState: HistoryState | null;
}
