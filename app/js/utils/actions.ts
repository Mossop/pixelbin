import { Action } from "redux";

import { ServerState, Catalog } from "../types";

export const SHOW_LOGIN_OVERLAY = "SHOW_LOGIN_OVERLAY";
export const SHOW_SIGNUP_OVERLAY = "SHOW_SIGNUP_OVERLAY";
export const CLOSE_OVERLAY = "CLOSE_OVERLAY";
export const COMPLETE_LOGIN = "COMPLETE_LOGIN";
export const COMPLETE_SIGNUP = "COMPLETE_SIGNUP";
export const COMPLETE_LOGOUT = "COMPLETE_LOGOUT";
export const CATALOG_CREATED = "CATALOG_CREATED";

export type ActionType =
  ShowLoginOverlayAction |
  ShowSignupOverlayAction |
  CompleteLoginAction |
  CompleteSignupAction |
  CompleteLogoutAction |
  CloseOverlayAction |
  CompleteLogoutAction |
  CatalogCreatedAction;

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

type ArgumentTypes<T> = T extends (... args: infer U ) => infer R ? U: never;
type IntoVoid<T> = (...a: ArgumentTypes<T>) => void;

export type DispatchProps<M> = {
  [P in keyof M]: IntoVoid<M[P]>;
};
