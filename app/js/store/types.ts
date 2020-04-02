import { Immutable } from "immer";

import { ServerData } from "../api/types";
import { OverlayState } from "../overlays";
import { PageState } from "../pages";

interface Settings {
  readonly thumbnailSize: number;
}

export interface UIState {
  page: PageState;
  overlay?: OverlayState;
}

export type ServerState = Immutable<ServerData>;

export interface StoreState {
  readonly serverState: ServerState;
  readonly ui: UIState;
  readonly settings: Settings;
  readonly stateId: number;
}
