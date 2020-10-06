import { Deed } from "deeds/immer";
import { Store } from "redux";

import { ServerState } from "../api/types";
import { OverlayState } from "../overlays/types";
import { PageState } from "../pages/types";

interface Settings {
  readonly thumbnailSize: number;
}

export interface UIState {
  readonly page: PageState;
  readonly overlay?: OverlayState;
}
export interface StoreState {
  readonly serverState: ServerState;
  readonly ui: UIState;
  readonly settings: Settings;
}

export type StoreType = Store<StoreState, Deed>;
