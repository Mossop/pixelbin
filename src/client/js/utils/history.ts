import { appURL, Url } from "../context";
import { document, URL, window } from "../environment";
import { exception, ErrorCode } from "./exception";

export interface HistoryState {
  readonly path: string;
  readonly params?: ReadonlyMap<string, string>;
  readonly hash?: string;
  readonly state?: unknown;
}

let listening = false;
function startListening(): void {
  if (listening) {
    return;
  }

  window.addEventListener("popstate", (): void => {
    let state = getState();

    for (let listener of listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error(e);
      }
    }
  });

  listening = true;
}

const listeners: Set<(state: HistoryState) => void> = new Set();

export function addListener(listener: (state: HistoryState) => void): void {
  listeners.add(listener);
  startListening();
}

export function removeListener(listener: (state: HistoryState) => void): void {
  listeners.delete(listener);
}

export function getState(): HistoryState {
  let url = new URL(document.URL);

  return {
    path: url.pathname,
    params: new Map(url.searchParams),
    hash: url.hash ? url.hash.substring(1) : undefined,
    state: window.history.state,
  };
}

export function buildState(
  path: string,
  params: Record<string, string> | Map<string, string> = {},
  hash?: string,
): HistoryState {
  if (!path.startsWith("/")) {
    exception(ErrorCode.InvalidState);
  }

  let newParams = params instanceof Map ? params : new Map<string, string>(Object.entries(params));

  return {
    path,
    params: newParams.size > 0 ? newParams : undefined,
    hash,
  };
}

export function buildURL(state: HistoryState): string {
  let url = appURL(Url.Root, state.path.substring(1));

  if (state.params) {
    for (let [key, value] of state.params) {
      url.searchParams.set(key, value);
    }
  }

  if (state.hash) {
    url.hash = "#" + state.hash;
  }

  return url.toString();
}

export function pushState(state: HistoryState): void {
  window.history.pushState(state.state, "", buildURL(state));
}

export function replaceState(state: HistoryState): void {
  window.history.replaceState(state.state, "", buildURL(state));
}
