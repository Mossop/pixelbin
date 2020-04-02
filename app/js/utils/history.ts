export interface HistoryState {
  path: string;
  params?: Map<string, string>;
  hash?: string;
  state?: unknown;
}

export type NewStateListener = (state: HistoryState) => void;

const listeners: Set<NewStateListener> = new Set();

export function addListener(listener: NewStateListener): void {
  listeners.add(listener);
}

export function removeListener(listener: NewStateListener): void {
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

export function buildURL(state: HistoryState): string {
  let url = new URL(window.location.protocol + window.location.host);
  url.pathname = state.path;

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

window.addEventListener("popstate", () => {
  let state = getState();

  for (let listener of listeners) {
    try {
      listener(state);
    } catch (e) {
      console.error(e);
    }
  }
});
