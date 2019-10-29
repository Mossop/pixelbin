import { StoreState } from "../store/types";

export function isLoggedIn(state: StoreState): boolean {
  return !!state.serverState.user;
}

export function uuid(): string {
  function s4(): string {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export function focus(id: string): void {
  let element = document.getElementById(id);
  if (element) {
    element.focus();

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.select();
    }
  }
}
