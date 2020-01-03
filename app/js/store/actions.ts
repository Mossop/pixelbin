import { Action } from "redux";

import { ServerState, Catalog, Album } from "../api/types";
import { HistoryState } from "../utils/history";
import { Draft } from "immer";
import { ErrorCode } from "../utils/exception";

export const SHOW_LOGIN_OVERLAY = "SHOW_LOGIN_OVERLAY";
export const SHOW_SIGNUP_OVERLAY = "SHOW_SIGNUP_OVERLAY";
export const CLOSE_OVERLAY = "CLOSE_OVERLAY";
export const COMPLETE_LOGIN = "COMPLETE_LOGIN";
export const COMPLETE_SIGNUP = "COMPLETE_SIGNUP";
export const COMPLETE_LOGOUT = "COMPLETE_LOGOUT";
export const CATALOG_CREATED = "CATALOG_CREATED";
export const SHOW_CATALOG_CREATE_OVERLAY = "SHOW_CATALOG_CREATE_OVERLAY";
export const SET_HISTORY_STATE = "SET_HISTORY_STATE";
export const SHOW_UPLOAD_OVERLAY = "SHOW_UPLOAD_OVERLAY";
export const SHOW_CATALOG_EDIT_OVERLAY = "SHOW_CATALOG_EDIT_OVERLAY";
export const SHOW_ALBUM_CREATE_OVERLAY = "SHOW_ALBUM_CREATE_OVERLAY";
export const SHOW_ALBUM_EDIT_OVERLAY = "SHOW_ALBUM_EDIT_OVERLAY";
export const ALBUM_CREATED = "ALBUM_CREATED";
export const ALBUM_EDITED = "ALBUM_EDITED";
export const BUMP_STATE = "BUMP_STATE";
export const EXCEPTION = "EXCEPTION";

type ArgumentTypes<F> = F extends (...args: infer A) => infer _R ? A : never;
type ReturnType<F> = F extends (...args: infer _A) => infer R ? R : never;
type IntoVoid<T> = (...a: ArgumentTypes<T>) => void;

export type StateProps<F> = ReturnType<F>;
export type DispatchProps<M> = {
  [P in keyof M]: IntoVoid<M[P]>;
};

export type ConnectedProps<P = {}, S = () => void, D = {}> = P & StateProps<S> & DispatchProps<D>;

export interface BaseAction extends Action{
  type: string;
}

export type ActionType =
  ShowLoginOverlayAction |
  ShowSignupOverlayAction |
  CompleteLoginAction |
  CompleteSignupAction |
  CompleteLogoutAction |
  CloseOverlayAction |
  CompleteLogoutAction |
  CatalogCreatedAction |
  ShowCatalogCreateOverlayAction |
  SetHistoryStateAction |
  ShowUploadOverlayAction |
  ShowCatalogEditOverlayAction |
  ShowAlbumCreateOverlayAction |
  ShowAlbumEditOverlayAction |
  AlbumCreatedAction |
  AlbumEditedAction |
  BumpStateAction |
  ExceptionAction;

interface ExceptionAction extends BaseAction {
  type: typeof EXCEPTION;
  payload: ErrorCode;
}

export function exceptionAction(code: ErrorCode): ExceptionAction {
  return {
    type: EXCEPTION,
    payload: code,
  };
}

interface BumpStateAction extends BaseAction {
  type: typeof BUMP_STATE;
}

export function bumpState(): BumpStateAction {
  return {
    type: BUMP_STATE,
  };
}

interface ShowAlbumCreateOverlayAction extends BaseAction {
  type: typeof SHOW_ALBUM_CREATE_OVERLAY;
  payload: Album;
}

export function showAlbumCreateOverlay(parent: Album): ShowAlbumCreateOverlayAction {
  return {
    type: SHOW_ALBUM_CREATE_OVERLAY,
    payload: parent,
  };
}

interface ShowAlbumEditOverlayAction extends BaseAction {
  type: typeof SHOW_ALBUM_EDIT_OVERLAY;
  payload: Album;
}

export function showAlbumEditOverlay(album: Album): ShowAlbumEditOverlayAction {
  return {
    type: SHOW_ALBUM_EDIT_OVERLAY,
    payload: album,
  };
}

interface ShowCatalogEditOverlayAction extends BaseAction {
  type: typeof SHOW_CATALOG_EDIT_OVERLAY;
  payload: Catalog;
}

export function showCatalogEditOverlay(catalog: Catalog): ShowCatalogEditOverlayAction {
  return {
    type: SHOW_CATALOG_EDIT_OVERLAY,
    payload: catalog,
  };
}

interface ShowUploadOverlayAction extends BaseAction {
  type: typeof SHOW_UPLOAD_OVERLAY;
  payload: Album;
}

export function showUploadOverlay(parent: Album): ShowUploadOverlayAction {
  return {
    type: SHOW_UPLOAD_OVERLAY,
    payload: parent,
  };
}

interface SetHistoryStateAction extends BaseAction {
  type: typeof SET_HISTORY_STATE;
  payload: HistoryState;
}

export function setHistoryState(historyState: HistoryState): SetHistoryStateAction {
  return {
    type: SET_HISTORY_STATE,
    payload: historyState,
  };
}

interface CatalogCreatedAction extends BaseAction {
  type: typeof CATALOG_CREATED;
  payload: Draft<Catalog>;
}

export function catalogCreated(newCatalog: Draft<Catalog>): CatalogCreatedAction {
  return {
    type: CATALOG_CREATED,
    payload: newCatalog,
  };
}

interface AlbumCreatedAction extends BaseAction {
  type: typeof ALBUM_CREATED;
  payload: Draft<Album>;
}

export function albumCreated(album: Draft<Album>): AlbumCreatedAction {
  return {
    type: ALBUM_CREATED,
    payload: album,
  };
}

interface AlbumEditedAction extends BaseAction {
  type: typeof ALBUM_EDITED;
  payload: Album;
}

export function albumEdited(album: Album): AlbumEditedAction {
  return {
    type: ALBUM_EDITED,
    payload: album,
  };
}

interface CloseOverlayAction extends BaseAction {
  type: typeof CLOSE_OVERLAY;
}

export function closeOverlay(): CloseOverlayAction {
  return {
    type: CLOSE_OVERLAY,
  };
}

interface ShowCatalogCreateOverlayAction extends BaseAction {
  type: typeof SHOW_CATALOG_CREATE_OVERLAY;
}

export function showCatalogCreateOverlay(): ShowCatalogCreateOverlayAction {
  return {
    type: SHOW_CATALOG_CREATE_OVERLAY,
  };
}

interface ShowLoginOverlayAction extends BaseAction {
  type: typeof SHOW_LOGIN_OVERLAY;
}

export function showLoginOverlay(): ShowLoginOverlayAction {
  return {
    type: SHOW_LOGIN_OVERLAY,
  };
}

interface ShowSignupOverlayAction extends BaseAction {
  type: typeof SHOW_SIGNUP_OVERLAY;
}

export function showSignupOverlay(): ShowSignupOverlayAction {
  return {
    type: SHOW_SIGNUP_OVERLAY,
  };
}

interface CompleteLoginAction extends BaseAction {
  type: typeof COMPLETE_LOGIN;
  payload: Draft<ServerState>;
}

export function completeLogin(newState: Draft<ServerState>): CompleteLoginAction {
  return {
    type: COMPLETE_LOGIN,
    payload: newState,
  };
}

interface CompleteSignupAction extends BaseAction {
  type: typeof COMPLETE_SIGNUP;
  payload: Draft<ServerState>;
}

export function completeSignup(newState: Draft<ServerState>): CompleteSignupAction {
  return {
    type: COMPLETE_SIGNUP,
    payload: newState,
  };
}

interface CompleteLogoutAction extends BaseAction {
  type: typeof COMPLETE_LOGOUT;
  payload: Draft<ServerState>;
}

export function completeLogout(newState: Draft<ServerState>): CompleteLogoutAction {
  return {
    type: COMPLETE_LOGOUT,
    payload: newState,
  };
}
