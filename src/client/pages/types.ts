import type { UserState } from "../api/types";
import type { HistoryState } from "../utils/history";
import type { AlbumPageProps } from "./Album";
import type { CatalogPageProps } from "./Catalog";
import type { MediaPageProps } from "./Media";
import { SearchPageProps } from "./Search";

export enum PageType {
  Root = "root",
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
  readonly type: PageType.Root | PageType.User;
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
