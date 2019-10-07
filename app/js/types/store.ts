import { ServerState } from "./api";

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
}
