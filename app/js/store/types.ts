import { ServerData } from "../api";
import { OverlayState } from "../overlays";
import { PageState } from "../pages";

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
