import { ServerState } from "./api";
import { HistoryState } from "../utils/history";

export enum OverlayType {
  Login,
  Signup,
  Logout,
  CreateCatalog,
}

export interface Overlay {
  type: OverlayType;
}

export interface StoreState {
  serverState: ServerState;
  overlay?: Overlay;
  historyState: HistoryState | null;
}
