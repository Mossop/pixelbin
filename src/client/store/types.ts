import type { Deed } from "deeds/immer";
import type { Store } from "redux";

import type { ServerState } from "../api/types";
import type { DialogState } from "../dialogs/types";
import type { PageState } from "../pages/types";

interface Settings {
  readonly thumbnailSize: number;
  readonly seenTouchMessage: boolean;
}

export interface UIState {
  readonly page: PageState;
  readonly dialog?: DialogState;
}

export interface StoreState {
  readonly serverState: ServerState;
  readonly ui: UIState;
  readonly settings: Settings;
}

export type StoreType = Store<StoreState, Deed>;
