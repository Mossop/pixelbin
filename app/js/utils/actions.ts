import { Action } from "redux";

import { UserState } from "../types";

export const SHOW_LOGIN_OVERLAY = "SHOW_LOGIN_OVERLAY";
export const CLOSE_OVERLAY = "CLOSE_OVERLAY";
export const COMPLETE_LOGIN = "COMPLETE_LOGIN";

export type ActionType = ShowLoginOverlayAction | CompleteLoginAction | CloseOverlayAction;

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

interface CompleteLoginAction extends Action {
  type: typeof COMPLETE_LOGIN;
  payload: UserState;
}

export function completeLogin(newState: UserState): CompleteLoginAction {
  return {
    type: COMPLETE_LOGIN,
    payload: newState,
  };
}

type ArgumentTypes<T> = T extends (... args: infer U ) => infer R ? U: never;
type IntoVoid<T> = (...a: ArgumentTypes<T>) => void;

export type DispatchProps<M> = {
  [P in keyof M]: IntoVoid<M[P]>;
};
