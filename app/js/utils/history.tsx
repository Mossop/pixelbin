import { Location, History, Action, UnregisterCallback, LocationListener, LocationDescriptorObject } from "history";
import { Store } from "redux";

import { setHistoryState } from "../store/actions";
import { StoreState, LocationState, HistoryState } from "../store/types";

function statesEqual(a: HistoryState, b: HistoryState): boolean {
  if (a === b) {
    return true;
  }

  if (a.url.toString() != b.url.toString()) {
    return false;
  }

  return true;
}

export interface ReduxHistory extends History<LocationState> {
  pushWithoutDispatch(pathOrLocation: string | LocationDescriptorObject<LocationState>, state?: LocationState): HistoryState;
  replaceWithoutDispatch(pathOrLocation: string | LocationDescriptorObject<LocationState>, state?: LocationState): HistoryState;
}

function buildHistoryState(state: LocationState = window.history.state): HistoryState {
  return {
    url: new URL(document.URL),
    state,
    length: window.history.length,
    action: "POP",
  };
}

export function createReduxHistory(store: Store<StoreState>): ReduxHistory {
  let listeners: Set<LocationListener<LocationState>> = new Set();
  let lastState: HistoryState = buildHistoryState();

  function locationFromState(state: HistoryState): Location<LocationState> {
    return {
      pathname: state.url.pathname,
      search: state.url.search,
      hash: state.url.hash,
      state: state.state,
    };
  }

  function intoURL(location: LocationDescriptorObject | string): URL {
    if (typeof location != "string") {
      let { pathname, search, hash } = location;
      location = `${pathname || "/"}${search || ""}${hash || ""}`;
    }

    return new URL(location, document.URL);
  }

  function currentState(): HistoryState {
    return lastState;
  }

  function currentLocation(): Location<LocationState> {
    return locationFromState(currentState());
  }

  function push(pathOrLocation: string | LocationDescriptorObject<LocationState>, state?: LocationState): HistoryState {
    let url = intoURL(pathOrLocation);
    window.history.pushState(state, "", url.toString());

    return {
      url,
      state,
      length: window.history.length + 1,
      action: "PUSH",
    };
  }

  function replace(pathOrLocation: string | LocationDescriptorObject<LocationState>, state?: LocationState): HistoryState {
    let url = intoURL(pathOrLocation);
    window.history.pushState(state, "", url.toString());

    return {
      url,
      state,
      length: window.history.length,
      action: "REPLACE",
    };
  }

  window.addEventListener("popstate", (event: PopStateEvent) => {
    store.dispatch(setHistoryState(buildHistoryState(event.state)));
  });

  let storeState = store.getState().historyState;

  // Make sure the store has the correct current state.
  if (storeState === null || !statesEqual(storeState, lastState)) {
    store.dispatch(setHistoryState(lastState));
  }

  store.subscribe(() => {
    let newState = store.getState().historyState;
    if (!newState) {
      return;
    }

    if (statesEqual(newState, lastState)) {
      lastState = newState;
      return;
    }

    lastState = newState;

    let location: Location<LocationState> = currentLocation();
    let action = currentState().action;
    for (let listener of listeners.values()) {
      listener(location, action);
    }
  });

  return {
    // The length of the history
    get length(): number {
      return currentState().length;
    },

    // The last action that happened?
    get action(): Action {
      return currentState().action;
    },

    // The current location
    get location(): Location<LocationState> {
      return Object.assign({}, currentLocation());
    },

    pushWithoutDispatch(pathOrLocation: string | LocationDescriptorObject<LocationState>, state?: LocationState): HistoryState {
      return push(pathOrLocation, state);
    },

    push(pathOrLocation: string | LocationDescriptorObject<LocationState>, state?: LocationState): void {
      let newState = push(pathOrLocation, state);
      store.dispatch(setHistoryState(newState));
    },

    replaceWithoutDispatch(pathOrLocation: string | LocationDescriptorObject<LocationState>, state?: LocationState): HistoryState {
      return replace(pathOrLocation, state);
    },

    replace(pathOrLocation: string | LocationDescriptorObject<LocationState>, state?: LocationState): void {
      let newState = replace(pathOrLocation, state);
      store.dispatch(setHistoryState(newState));
    },

    go(n: number): void {
      window.history.go(n);
    },

    goBack(): void {
      window.history.back();
    },

    goForward(): void {
      window.history.forward();
    },

    block(): UnregisterCallback {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return (): void => {};
    },

    listen(listener: LocationListener<LocationState>): UnregisterCallback {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },

    createHref(location: LocationDescriptorObject<LocationState>): string {
      let url = intoURL(location);
      return url.toString();
    },
  };
}

// export class ReduxRouter extends React.Component {
//   public render(): React.ReactNode {
//     return <Router history={history}>{this.props.children}</Router>;
//   }
// }
