import React from "react";

import { useSelector } from "../store";
import { useActions } from "../store/actions";
import { StoreState } from "../store/types";
import { ReactResult } from "../utils/types";
import AlbumOverlay from "./album";
import CatalogOverlay from "./catalog";
import LoginOverlay from "./login";
import SignupOverlay from "./signup";
import { OverlayType } from "./types";

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
