import { Action } from "redux";

import { ServerState, Catalog, Album } from "../api/types";
import { HistoryState } from "../utils/history";

export const SHOW_LOGIN_OVERLAY = "SHOW_LOGIN_OVERLAY";
export const SHOW_SIGNUP_OVERLAY = "SHOW_SIGNUP_OVERLAY";
export const CLOSE_OVERLAY = "CLOSE_OVERLAY";
export const COMPLETE_LOGIN = "COMPLETE_LOGIN";
export const COMPLETE_SIGNUP = "COMPLETE_SIGNUP";
export const COMPLETE_LOGOUT = "COMPLETE_LOGOUT";
export const CATALOG_CREATED = "CATALOG_CREATED";
export const CATALOG_EDITED = "CATALOG_EDITED";
export const SHOW_CATALOG_CREATE_OVERLAY = "SHOW_CATALOG_CREATE_OVERLAY";
export const SET_HISTORY_STATE = "SET_HISTORY_STATE";
export const SHOW_UPLOAD_OVERLAY = "SHOW_UPLOAD_OVERLAY";
export const SHOW_CATALOG_EDIT_OVERLAY = "SHOW_CATALOG_EDIT_OVERLAY";
export const SHOW_ALBUM_CREATE_OVERLAY = "SHOW_ALBUM_CREATE_OVERLAY";
export const SHOW_ALBUM_EDIT_OVERLAY = "SHOW_ALBUM_EDIT_OVERLAY";
export const ALBUM_CREATED = "ALBUM_CREATED";
export const ALBUM_EDITED = "ALBUM_EDITED";

type ArgumentTypes<F> = F extends (...args: infer A) => infer _R ? A : never;
type ReturnType<F> = F extends (...args: infer _A) => infer R ? R : never;
type IntoVoid<T> = (...a: ArgumentTypes<T>) => void;

export type StateProps<F> = ReturnType<F>;
export type DispatchProps<M> = {
  [P in keyof M]: IntoVoid<M[P]>;
};

export type ConnectedProps<P = {}, S = () => void, D = {}> = P & StateProps<S> & DispatchProps<D>;

export type ActionType =
  ShowLoginOverlayAction |
  ShowSignupOverlayAction |
  CompleteLoginAction |
  CompleteSignupAction |
  CompleteLogoutAction |
  CloseOverlayAction |
  CompleteLogoutAction |
  CatalogCreatedAction |
  CatalogEditedAction |
  ShowCatalogCreateOverlayAction |
  SetHistoryStateAction |
  ShowUploadOverlayAction |
  ShowCatalogEditOverlayAction |
  ShowAlbumCreateOverlayAction |
  ShowAlbumEditOverlayAction |
  AlbumCreatedAction |
  AlbumEditedAction;

interface ShowAlbumCreateOverlayAction extends Action {
  type: typeof SHOW_ALBUM_CREATE_OVERLAY;
  payload: {
    catalog: Catalog;
    parent?: Album;
  };
}

export function showAlbumCreateOverlay(catalog: Catalog, parent?: Album): ShowAlbumCreateOverlayAction {
  return {
    type: SHOW_ALBUM_CREATE_OVERLAY,
    payload: {
      catalog,
      parent,
    }
  };
}

interface ShowAlbumEditOverlayAction extends Action {
  type: typeof SHOW_ALBUM_EDIT_OVERLAY;
  payload: {
    album: Album;
    catalog: Catalog;
  };
}

export function showAlbumEditOverlay(catalog: Catalog, album: Album): ShowAlbumEditOverlayAction {
  return {
    type: SHOW_ALBUM_EDIT_OVERLAY,
    payload: {
      album,
      catalog,
    },
  };
}

interface ShowCatalogEditOverlayAction extends Action {
  type: typeof SHOW_CATALOG_EDIT_OVERLAY;
  payload: Catalog;
}

export function showCatalogEditOverlay(catalog: Catalog): ShowCatalogEditOverlayAction {
  return {
    type: SHOW_CATALOG_EDIT_OVERLAY,
    payload: catalog,
  };
}

interface ShowUploadOverlayAction extends Action {
  type: typeof SHOW_UPLOAD_OVERLAY;
  payload: {
    catalog?: Catalog;
    parent?: Album;
  };
}

export function showUploadOverlay(catalog?: Catalog, parent?: Album): ShowUploadOverlayAction {
  return {
    type: SHOW_UPLOAD_OVERLAY,
    payload: {
      catalog,
      parent,
    }
  };
}

interface SetHistoryStateAction extends Action {
  type: typeof SET_HISTORY_STATE;
  payload: HistoryState;
}

export function setHistoryState(historyState: HistoryState): SetHistoryStateAction {
  return {
    type: SET_HISTORY_STATE,
    payload: historyState,
  };
}

interface CatalogCreatedAction extends Action {
  type: typeof CATALOG_CREATED;
  payload: Catalog;
}

export function catalogCreated(newCatalog: Catalog): CatalogCreatedAction {
  return {
    type: CATALOG_CREATED,
    payload: newCatalog,
  };
}

interface AlbumCreatedAction extends Action {
  type: typeof ALBUM_CREATED;
  payload: {
    catalog: Catalog;
    album: Album;
  };
}

export function albumCreated(catalog: Catalog, album: Album): AlbumCreatedAction {
  return {
    type: ALBUM_CREATED,
    payload: {
      catalog,
      album,
    }
  };
}

interface AlbumEditedAction extends Action {
  type: typeof ALBUM_EDITED;
  payload: {
    catalog: Catalog;
    album: Album;
  };
}

export function albumEdited(catalog: Catalog, album: Album): AlbumEditedAction {
  return {
    type: ALBUM_EDITED,
    payload: {
      catalog,
      album,
    },
  };
}

interface CatalogEditedAction extends Action {
  type: typeof CATALOG_EDITED;
  payload: Catalog;
}

export function catalogEdited(catalog: Catalog): CatalogEditedAction {
  return {
    type: CATALOG_EDITED,
    payload: catalog,
  };
}

interface CloseOverlayAction extends Action {
  type: typeof CLOSE_OVERLAY;
}

export function closeOverlay(): CloseOverlayAction {
  return {
    type: CLOSE_OVERLAY,
  };
}

interface ShowCatalogCreateOverlayAction extends Action {
  type: typeof SHOW_CATALOG_CREATE_OVERLAY;
}

export function showCatalogCreateOverlay(): ShowCatalogCreateOverlayAction {
  return {
    type: SHOW_CATALOG_CREATE_OVERLAY,
  };
}

interface ShowLoginOverlayAction extends Action {
  type: typeof SHOW_LOGIN_OVERLAY;
}

export function showLoginOverlay(): ShowLoginOverlayAction {
  return {
    type: SHOW_LOGIN_OVERLAY,
  };
}

interface ShowSignupOverlayAction extends Action {
  type: typeof SHOW_SIGNUP_OVERLAY;
}

export function showSignupOverlay(): ShowSignupOverlayAction {
  return {
    type: SHOW_SIGNUP_OVERLAY,
  };
}

interface CompleteLoginAction extends Action {
  type: typeof COMPLETE_LOGIN;
  payload: ServerState;
}

export function completeLogin(newState: ServerState): CompleteLoginAction {
  return {
    type: COMPLETE_LOGIN,
    payload: newState,
  };
}

interface CompleteSignupAction extends Action {
  type: typeof COMPLETE_SIGNUP;
  payload: ServerState;
}

export function completeSignup(newState: ServerState): CompleteSignupAction {
  return {
    type: COMPLETE_SIGNUP,
    payload: newState,
  };
}

interface CompleteLogoutAction extends Action {
  type: typeof COMPLETE_LOGOUT;
  payload: ServerState;
}

export function completeLogout(newState: ServerState): CompleteLogoutAction {
  return {
    type: COMPLETE_LOGOUT,
    payload: newState,
  };
}