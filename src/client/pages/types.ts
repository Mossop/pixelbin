import { Reference, Catalog } from "../api/highlevel";
import { UserState } from "../api/types";
import { HistoryState } from "../utils/history";
import { AlbumPageProps } from "./album";

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

interface CatalogPageState {
  readonly type: PageType.Catalog;
  readonly catalog: Reference<Catalog>;
}

export type AlbumPageState = Readonly<AlbumPageProps> & {
  readonly type: PageType.Album;
};

interface NotFoundPageState {
  readonly type: PageType.NotFound;
  readonly history: HistoryState;
}

export type PageState = BasePageState | CatalogPageState | AlbumPageState | NotFoundPageState;
