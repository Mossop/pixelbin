import type { Deed } from "deeds/immer";
import type { Store } from "redux";

import type { ServerState } from "../api/types";
import type { OverlayState } from "../overlays/types";
import type { PageState } from "../pages/types";

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
