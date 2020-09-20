import { Deed } from "deeds/immer";
import { Store } from "redux";

import { Album, Reference } from "../api/highlevel";
import { MediaState, ServerState } from "../api/types";
import { OverlayState } from "../overlays/types";
import { PageState } from "../pages/types";

interface Settings {
  readonly thumbnailSize: number;
}

export interface UIState {
  readonly page: PageState;
  readonly overlay?: OverlayState;
}

export enum MediaLookupType {
  Album,
}

export interface AlbumMediaLookup {
  type: MediaLookupType.Album;
  album: Reference<Album>;
  recursive: boolean;
}

export type MediaLookup = AlbumMediaLookup;

export interface MediaSearch {
  readonly lookup: MediaLookup;
  readonly media: readonly MediaState[] | null;
}

export interface StoreState {
  readonly serverState: ServerState;
  readonly ui: UIState;
  readonly settings: Settings;
  readonly mediaList: MediaSearch | null;
}

export type StoreType = Store<StoreState, Deed>;
