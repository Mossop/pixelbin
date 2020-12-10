import type { UserState } from "../api/types";
import type { HistoryState } from "../utils/history";
import type { AlbumPageProps } from "./Album";
import type { CatalogPageProps } from "./Catalog";
import type { SavedSearchPageProps } from "./SavedSearch";
import type { SearchPageProps } from "./Search";
import type { SharedSearchPageProps } from "./SharedSearch";

export enum PageType {
  Root = "root",
  Catalog = "catalog",
  Album = "album",
  User = "user",
  Search = "search",
  SavedSearch = "savedSearch",
  SharedSearch = "sharedearch",
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

type SearchPageState = SearchPageProps & {
  readonly type: PageType.Search;
};

type SavedSearchPageState = SavedSearchPageProps & {
  readonly type: PageType.SavedSearch;
};

type SharedSearchPageState = SharedSearchPageProps & {
  readonly type: PageType.SharedSearch;
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
  SearchPageState |
  SavedSearchPageState |
  SharedSearchPageState;
