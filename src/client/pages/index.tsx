import React, { lazy } from "react";

import { useSelector } from "../store";
import { StoreState } from "../store/types";
import { ErrorCode, InternalError } from "../utils/exception";
import { ReactResult } from "../utils/types";
import ErrorPage from "./error";
import Index from "./indexpage";
import NotFound from "./notfound";
import { PageType } from "./types";

const Album = lazy(() => import(/* webpackChunkName: "AlbumPage" */ "./album"));
const Catalog = lazy(() => import(/* webpackChunkName: "CatalogPage" */ "./catalog"));
const User = lazy(() => import(/* webpackChunkName: "UserPage" */ "./user"));
const Media = lazy(() => import(/* webpackChunkName: "MediaPage" */ "./media"));

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
      case PageType.Media: {
        return <Media user={user} {...page}/>;
      }
    }
  }

  switch (page.type) {
    case PageType.Index: {
      return <Index/>;
    }
    case PageType.NotFound: {
      return <NotFound/>;
    }
  }

  return <ErrorPage error={new InternalError(ErrorCode.InvalidState)}/>;
}