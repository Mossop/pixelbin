import { UserState } from "./api";

export enum OverlayType {
  Login,
  Logout,
}

export interface Overlay {
  type: OverlayType;
}

export interface StoreState {
  userState: UserState;
  overlay?: Overlay;
}
