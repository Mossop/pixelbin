import { Draft } from "immer";
import { Action } from "redux";

import { Album, Catalog, Reference } from "../api/highlevel";
import { MediaTarget } from "../api/media";
import { ServerData, CatalogData, AlbumData } from "../api/types";
import { ErrorCode } from "../utils/exception";
import { HistoryState } from "./types";

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
  payload: {
    parent: Reference<MediaTarget>;
  };
}

export function showAlbumCreateOverlay(parent: MediaTarget): ShowAlbumCreateOverlayAction {
  return {
    type: SHOW_ALBUM_CREATE_OVERLAY,
    payload: {
      parent: parent.ref(),
    },
  };
}

interface ShowAlbumEditOverlayAction extends BaseAction {
  type: typeof SHOW_ALBUM_EDIT_OVERLAY;
  payload: {
    album: Reference<Album>;
  };
}

export function showAlbumEditOverlay(album: Album): ShowAlbumEditOverlayAction {
  return {
    type: SHOW_ALBUM_EDIT_OVERLAY,
    payload: {
      album: album.ref(),
    },
  };
}

interface ShowCatalogEditOverlayAction extends BaseAction {
  type: typeof SHOW_CATALOG_EDIT_OVERLAY;
  payload: {
    catalog: Reference<Catalog>;
  };
}

export function showCatalogEditOverlay(catalog: Catalog): ShowCatalogEditOverlayAction {
  return {
    type: SHOW_CATALOG_EDIT_OVERLAY,
    payload: {
      catalog: catalog.ref(),
    },
  };
}

interface ShowUploadOverlayAction extends BaseAction {
  type: typeof SHOW_UPLOAD_OVERLAY;
  payload: {
    target: Reference<MediaTarget> | undefined;
  };
}

export function showUploadOverlay(parent: MediaTarget | undefined): ShowUploadOverlayAction {
  return {
    type: SHOW_UPLOAD_OVERLAY,
    payload: {
      target: parent?.ref(),
    },
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
  payload: {
    catalog: Draft<CatalogData>;
  };
}

export function catalogCreated(catalog: Draft<CatalogData>): CatalogCreatedAction {
  return {
    type: CATALOG_CREATED,
    payload: {
      catalog,
    },
  };
}

interface AlbumCreatedAction extends BaseAction {
  type: typeof ALBUM_CREATED;
  payload: {
    album: Draft<AlbumData>;
  };
}

export function albumCreated(album: Draft<AlbumData>): AlbumCreatedAction {
  return {
    type: ALBUM_CREATED,
    payload: {
      album,
    },
  };
}

interface AlbumEditedAction extends BaseAction {
  type: typeof ALBUM_EDITED;
  payload: {
    album: Draft<AlbumData>;
  };
}

export function albumEdited(album: Draft<AlbumData>): AlbumEditedAction {
  return {
    type: ALBUM_EDITED,
    payload: {
      album,
    },
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
  payload: Draft<ServerData>;
}

export function completeLogin(newState: Draft<ServerData>): CompleteLoginAction {
  return {
    type: COMPLETE_LOGIN,
    payload: newState,
  };
}

interface CompleteSignupAction extends BaseAction {
  type: typeof COMPLETE_SIGNUP;
  payload: Draft<ServerData>;
}

export function completeSignup(newState: Draft<ServerData>): CompleteSignupAction {
  return {
    type: COMPLETE_SIGNUP,
    payload: newState,
  };
}

interface CompleteLogoutAction extends BaseAction {
  type: typeof COMPLETE_LOGOUT;
  payload: Draft<ServerData>;
}

export function completeLogout(newState: Draft<ServerData>): CompleteLogoutAction {
  return {
    type: COMPLETE_LOGOUT,
    payload: newState,
  };
}
