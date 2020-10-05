import type { UserState } from "../api/types";
import type { HistoryState } from "../utils/history";
import type { AlbumPageProps } from "./album";
import type { CatalogPageProps } from "./catalog";
import type { MediaPageProps } from "./media";
import { SearchPageProps } from "./search";

export enum PageType {
  Index = "index",
  Catalog = "catalog",
  Album = "album",
  User = "user",
  Media = "media",
  Search = "search",
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

type MediaPageState = MediaPageProps & {
  readonly type: PageType.Media;
};

type SearchPageState = SearchPageProps & {
  readonly type: PageType.Search;
};

interface NotFoundPageState {
  readonly type: PageType.NotFound;
  readonly history: HistoryState;
}

export type PageState =
  BasePageState |
  CatalogPageState |
  AlbumPageState |
  NotFoundPageState |
  MediaPageState |
  SearchPageState;
