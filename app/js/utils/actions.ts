import { Action } from "redux";

import { ServerState, Catalog } from "../types";
import { HistoryState } from "./history";

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
  ShowCatalogCreateOverlayAction |
  SetHistoryStateAction |
  ShowUploadOverlayAction;

interface ShowUploadOverlayAction extends Action {
  type: typeof SHOW_UPLOAD_OVERLAY;
  payload: {
    catalog: string | undefined;
    album: string | undefined;
  };
}

export function showUploadOverlay(catalog?: string, album?: string): ShowUploadOverlayAction {
  return {
    type: SHOW_UPLOAD_OVERLAY,
    payload: {
      catalog,
      album,
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
