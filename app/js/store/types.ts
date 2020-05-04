import { ServerData } from "../api";
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
  readonly serverState: ServerData;
  readonly ui: UIState;
  readonly settings: Settings;
  readonly stateId: number;
}
