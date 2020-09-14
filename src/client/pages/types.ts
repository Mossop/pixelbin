import { Reference, Catalog, Album } from "../api/highlevel";
import { MediaState } from "../api/types";
import { HistoryState } from "../utils/history";
import { ReadonlyMapOf } from "../utils/maps";

export enum PageType {
  Index = "index",
  Catalog = "catalog",
  Album = "album",
  User = "user",
  NotFound = "notfound",
}

interface BasePageState {
  readonly type: PageType.Index | PageType.User;
}

interface CatalogPageState {
  readonly type: PageType.Catalog;
  readonly catalog: Reference<Catalog>;
}

interface AlbumPageState {
  readonly type: PageType.Album;
  readonly album: Reference<Album>;
  readonly media?: ReadonlyMapOf<MediaState>;
}

interface NotFoundPageState {
  readonly type: PageType.NotFound;
  readonly history: HistoryState;
}

export type PageState = BasePageState | CatalogPageState | AlbumPageState | NotFoundPageState;
