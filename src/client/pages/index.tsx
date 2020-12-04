import React, { lazy } from "react";

import { useSelector } from "../store";
import type { StoreState } from "../store/types";
import { ErrorCode, InternalError } from "../utils/exception";
import type { ReactResult } from "../utils/types";
import ErrorPage from "./Error";
import NotFound from "./NotFound";
import Root from "./Root";
import { PageType } from "./types";

const Album = lazy(() => import(/* webpackChunkName: "AlbumPage" */ "./Album"));
const Catalog = lazy(() => import(/* webpackChunkName: "CatalogPage" */ "./Catalog"));
const User = lazy(() => import(/* webpackChunkName: "UserPage" */ "./User"));
const Search = lazy(() => import(/* webpackChunkName: "SearchPage" */ "./Search"));
const SavedSearch = lazy(() => import(/* webpackChunkName: "SavedSearch" */ "./SavedSearch"));

export default function PageDisplay(): ReactResult {
  let { user, page } = useSelector((state: StoreState) => ({
    user: state.serverState.user,
    page: state.ui.page,
  }));

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
    }
  }

  switch (page.type) {
    case PageType.Root: {
      return <Root/>;
    }
    case PageType.SavedSearch: {
      return <SavedSearch {...page}/>;
    }
    case PageType.NotFound: {
      return <NotFound/>;
    }
  }

  return <ErrorPage error={new InternalError(ErrorCode.InvalidState)}/>;
}
