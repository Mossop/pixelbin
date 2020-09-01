import React from "react";
import { asyncComponent } from "react-async-component";

import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { StoreState } from "../store/types";
import { ReactResult } from "../utils/types";
import { OverlayType } from "./types";

const LoginOverlay = asyncComponent({
  name: "AsyncLoginOverlay",
  resolve: () => import(/* webpackChunkName: "LoginOverlay" */ "./login"),
});

const AlbumOverlay = asyncComponent({
  name: "AsyncAlbumOverlay",
  resolve: () => import(/* webpackChunkName: "AlbumOverlay" */ "./album"),
});

const CatalogOverlay = asyncComponent({
  name: "AsyncCatalogOverlay",
  resolve: () => import(/* webpackChunkName: "CatalogOverlay" */ "./catalog"),
});

const SignupOverlay = asyncComponent({
  name: "AsyncSignupOverlay",
  resolve: () => import(/* webpackChunkName: "SignupOverlay" */ "./signup"),
});

export default function Overlay(): ReactResult {
  const actions = useActions();

  let { overlay, user } = useSelector((state: StoreState) => ({
    overlay: state.ui.overlay,
    user: state.serverState.user,
  }));

  if (!overlay) {
    return null;
  }

  if (!user) {
    switch (overlay.type) {
      case OverlayType.Login: {
        return <LoginOverlay/>;
      }
      case OverlayType.Signup: {
        return <SignupOverlay/>;
      }
    }
  } else {
    switch (overlay.type) {
      case OverlayType.CreateCatalog: {
        return <CatalogOverlay user={user}/>;
      }
      case OverlayType.CreateAlbum: {
        return <AlbumOverlay parent={overlay.parent}/>;
      }
      case OverlayType.EditAlbum: {
        return <AlbumOverlay album={overlay.album}/>;
      }
    }
  }

  console.error(`State contained an illegal overlay: ${overlay.type}`);
  actions.closeOverlay();
  return null;
}
