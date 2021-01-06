import { lazy } from "react";

import { useSelector, useUserState } from "../store";
import type { StoreState } from "../store/types";
import { ErrorCode, InternalError } from "../utils/exception";
import type { ReactResult } from "../utils/types";
import ErrorPage from "./Error";
import NotFound from "./NotFound";
import Root from "./Root";
import type { PageState } from "./types";
import { PageType } from "./types";

const Album = lazy(() => import(/* webpackChunkName: "AlbumPage" */ "./Album"));
const Catalog = lazy(() => import(/* webpackChunkName: "CatalogPage" */ "./Catalog"));
const User = lazy(() => import(/* webpackChunkName: "UserPage" */ "./User"));
const Search = lazy(() => import(/* webpackChunkName: "SearchPage" */ "./Search"));
const SavedSearch = lazy(() => import(/* webpackChunkName: "SavedSearch" */ "./SavedSearch"));
const SharedSearch = lazy(() => import(/* webpackChunkName: "SharedSearch" */ "./SharedSearch"));

function pageSelector(state: StoreState): PageState {
  return state.ui.page;
}

export default function PageDisplay(): ReactResult {
  let user = useUserState();
  let page = useSelector(pageSelector);

  if (user) {
    switch (page.type) {
      case PageType.User: {
        return <User user={user} {...page}/>;
      }
      case PageType.Catalog: {
        return <Catalog user={user} {...page}/>;
      }
      case PageType.Album: {
        return <Album user={user} {...page}/>;
      }
      case PageType.Search: {
        return <Search user={user} {...page}/>;
      }
      case PageType.SavedSearch: {
        return <SavedSearch {...page}/>;
      }
    }
  }

  switch (page.type) {
    case PageType.Root: {
      return <Root/>;
    }
    case PageType.SharedSearch: {
      return <SharedSearch {...page}/>;
    }
    case PageType.NotFound: {
      return <NotFound/>;
    }
  }

  return <ErrorPage error={new InternalError(ErrorCode.InvalidState)}/>;
}
