import React, { lazy } from "react";

import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { StoreState } from "../store/types";
import { ReactResult } from "../utils/types";
import { OverlayType } from "./types";

const LoginOverlay = lazy(() => import(/* webpackChunkName: "LoginOverlay" */ "./Login"));
const AlbumOverlay = lazy(() => import(/* webpackChunkName: "AlbumOverlay" */ "./Album"));
const CreateCatalogOverlay = lazy(() =>
  import(/* webpackChunkName: "CreateCatalog" */ "./CreateCatalog"));
const SignupOverlay = lazy(() => import(/* webpackChunkName: "SignupOverlay" */ "./Signup"));
const SearchOverlay = lazy(() => import(/* webpackChunkName: "SearchOverlay" */ "./Search"));

export default function Overlay(): ReactResult {
  const actions = useActions();

  let { overlay, user } = useSelector((state: StoreState) => ({
    overlay: state.ui.overlay,
    user: state.serverState.user,
  }));

  if (!overlay) {
    return null;
  }

  if (user) {
    switch (overlay.type) {
      case OverlayType.CreateCatalog: {
        return <CreateCatalogOverlay user={user}/>;
      }
      case OverlayType.CreateAlbum: {
        return <AlbumOverlay {...overlay}/>;
      }
      case OverlayType.EditAlbum: {
        return <AlbumOverlay {...overlay}/>;
      }
      case OverlayType.Search: {
        return <SearchOverlay {...overlay}/>;
      }
    }
  }

  switch (overlay.type) {
    case OverlayType.Login: {
      return <LoginOverlay/>;
    }
    case OverlayType.Signup: {
      return <SignupOverlay/>;
    }
  }

  console.error(`State contained an illegal overlay: ${overlay.type}`);
  actions.closeOverlay();
  return null;
}
