import { ServerData } from "../api";
import { Catalog, Album } from "../api/highlevel";
import { OverlayType } from "../overlays";
import { PageType } from "../pages/types";
import { StoreType, UIState } from "../store";
import actions from "../store/actions";
import { exception, ErrorCode } from "./exception";
import { createDraft } from "./helpers";
import * as history from "./history";
import { HistoryState, buildState } from "./history";

function encodeTargetState(uiState: UIState): Map<string, string> | undefined {
  if (uiState.overlay === undefined) {
    // This would guarantee infinite recursion.
    exception(ErrorCode.InvalidState);
  }

  let target: UIState = Object.assign({}, uiState, {
    overlay: undefined,
  });

  let historyState = fromUIState(target);
  if (historyState.state !== undefined) {
    exception(ErrorCode.InvalidState);
  }

  if (historyState.path == "/" && !historyState.params?.size) {
    return undefined;
  }

  let params = new Map<string, string>(historyState.params?.entries() ?? []);

  if (params.has("path")) {
    exception(ErrorCode.InvalidState);
  }

  if (historyState.path != "/") {
    let path = historyState.path;
    if (historyState.hash) {
      path += `#${historyState.hash}`;
    }
    params.set("path", path);
  }

  return params;
}

function decodeTargetState(
  params: ReadonlyMap<string, string> | undefined,
  serverState: ServerData,
): UIState {
  if (!params) {
    return {
      page: {
        type: PageType.Index,
      },
    };
  }

  let clone = new Map(params);
  let path = clone.get("path");
  if (path) {
    clone.delete("path");
  } else {
    path = "";
  }

  let hash: string | undefined = undefined;
  let pos = path.indexOf("#");
  if (pos >= 0) {
    hash = path.substring(pos + 1);
    path = path.substring(0, pos);
  }

  if (!path) {
    path = "/";
  }

  let historyState: HistoryState = {
    path,
    hash,
    params: clone.size ? clone : undefined,
  };

  return intoUIState(historyState, serverState);
}

function matchesType(path: string, type: string): string | null {
  if (path.startsWith(`/${type}/`)) {
    return path.substring(type.length + 2);
  }
  return null;
}

function notfound(historyState: HistoryState): UIState {
  return {
    page: {
      type: PageType.NotFound,
      history: historyState,
    },
  };
}

export function intoUIState(historyState: HistoryState, serverState: ServerData): UIState {
  switch (historyState.path) {
    case "/": {
      return {
        page: {
          type: PageType.Index,
        },
      };
    }

    case "/user": {
      if (!serverState.user) {
        return notfound(historyState);
      }

      return {
        page: {
          type: PageType.User,
        },
      };
    }

    case "/upload": {
      if (!serverState.user) {
        return notfound(historyState);
      }

      if (!historyState.params || historyState.params.size == 0) {
        return {
          page: {
            type: PageType.User,
          },
          overlay: {
            type: OverlayType.Upload,
          },
        };
      }

      if (historyState.params.size != 1) {
        break;
      }

      let id = historyState.params.get("catalog");
      if (id) {
        let catalog = Catalog.safeFromState(serverState, id);
        if (!catalog) {
          return notfound(historyState);
        }

        return {
          page: {
            type: PageType.Catalog,
            catalog: catalog.ref(),
          },
          overlay: {
            type: OverlayType.Upload,
          },
        };
      }

      id = historyState.params.get("album");
      if (id) {
        let album = Album.safeFromState(serverState, id);
        if (!album) {
          return notfound(historyState);
        }

        return {
          page: {
            type: PageType.Album,
            album: album.ref(),
          },
          overlay: {
            type: OverlayType.Upload,
          },
        };
      }

      break;
    }

    case "/login": {
      return Object.assign({}, decodeTargetState(historyState.params, serverState), {
        overlay: {
          type: OverlayType.Login,
        },
      });
    }
  }

  let id = matchesType(historyState.path, "catalog");
  if (id) {
    let catalog = Catalog.safeFromState(serverState, id);
    if (!catalog) {
      return notfound(historyState);
    }

    return {
      page: {
        type: PageType.Catalog,
        catalog: catalog.ref(),
      },
    };
  }

  id = matchesType(historyState.path, "album");
  if (id) {
    let album = Album.safeFromState(serverState, id);
    if (!album) {
      return notfound(historyState);
    }

    return {
      page: {
        type: PageType.Album,
        album: album.ref(),
      },
    };
  }

  return notfound(historyState);
}

export function fromUIState(uiState: UIState): HistoryState {
  switch (uiState.overlay?.type) {
    case OverlayType.Upload: {
      switch (uiState.page.type) {
        case PageType.User:
          return buildState("/upload");
        case PageType.Catalog:
          return buildState("/upload", {
            catalog: uiState.page.catalog.id,
          });
        case PageType.Album:
          return buildState("/upload", {
            album: uiState.page.album.id,
          });
      }

      exception(ErrorCode.InvalidState);
      break;
    }
    case OverlayType.Login: {
      return buildState("/login", encodeTargetState(uiState));
    }
  }

  switch (uiState.page.type) {
    case PageType.Index: {
      return buildState("/");
    }
    case PageType.User: {
      return buildState("/user");
    }
    case PageType.Catalog: {
      return buildState(`/catalog/${uiState.page.catalog.id}`);
    }
    case PageType.Album: {
      return buildState(`/album/${uiState.page.album.id}`);
    }

    case PageType.NotFound: {
      return uiState.page.history;
    }
  }
}

// Checks that the history states match in all respects other than the state.
export function stateURLMatches(a: HistoryState, b: HistoryState): boolean {
  if (!Object.is(a.path, b.path)) {
    return false;
  }

  if (!Object.is(a.hash, b.hash)) {
    return false;
  }

  if (Object.is(a.params, b.params)) {
    return true;
  }

  if (!a.params || !b.params) {
    return false;
  }

  let keys = new Set(a.params.keys());
  for (let key of b.params.keys()) {
    if (!keys.has(key)) {
      return false;
    }
  }

  for (let key of keys) {
    if (!b.params.has(key)) {
      return false;
    }

    if (!Object.is(a.params.get(key), b.params.get(key))) {
      return false;
    }
  }

  return true;
}

export function watchStore(store: StoreType): void {
  let historyState = history.getState();
  let uiState = createDraft(intoUIState(historyState, store.getState().serverState));

  history.addListener((newHistoryState: HistoryState): void => {
    historyState = newHistoryState;
    uiState = createDraft(intoUIState(historyState, store.getState().serverState));
    store.dispatch(actions.updateUIState(uiState));
  });

  store.dispatch(actions.updateUIState(uiState));

  store.subscribe((): void => {
    let storeUIState = store.getState().ui;
    if (storeUIState === uiState) {
      return;
    }

    uiState = createDraft(storeUIState);
    let newHistoryState = fromUIState(uiState);
    if (stateURLMatches(historyState, newHistoryState)) {
      history.replaceState(newHistoryState);
    } else {
      history.pushState(newHistoryState);
    }

    historyState = newHistoryState;
  });
}
