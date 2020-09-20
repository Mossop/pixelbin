import type { UserState } from "../api/types";
import type { HistoryState } from "../utils/history";
import type { AlbumPageProps } from "./album";
import type { CatalogPageProps } from "./catalog";

export enum PageType {
  Index = "index",
  Catalog = "catalog",
  Album = "album",
  User = "user",
  NotFound = "notfound",
}

export interface AuthenticatedPageProps {
  user: UserState;
}

interface BasePageState {
  readonly type: PageType.Index | PageType.User;
}

type CatalogPageState = CatalogPageProps & {
  readonly type: PageType.Catalog;
};

type AlbumPageState = AlbumPageProps & {
  readonly type: PageType.Album;
};

interface NotFoundPageState {
  readonly type: PageType.NotFound;
  readonly history: HistoryState;
}

export type PageState = BasePageState | CatalogPageState | AlbumPageState | NotFoundPageState;
