import { ServerState } from "./api";

export enum OverlayType {
  Login,
  Logout,
}

export interface Overlay {
  type: OverlayType;
}

export interface StoreState {
  serverState: ServerState;
  overlay?: Overlay;
}
