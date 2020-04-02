import { Draft } from "immer";

import { Catalog, Album } from "../api/highlevel";
import { OverlayType } from "../overlays";
import { PageType } from "../pages";
import { UIState, ServerState } from "../store/types";
import * as history from "./history";
import { HistoryState } from "./history";

function encodeHistoryState(historyState: HistoryState): Map<string, string> {
  let params = new Map();
  params.set("target", historyState.path + (historyState.hash ? `#${historyState.hash}` : ""));
  return params;
}

function decodeHistoryState(params: Map<string, string> | undefined): HistoryState {
  let target = params?.get("target") ?? "/";
  let pos = target.indexOf("#");
  if (pos >= 0) {
    return {
      path: target.substring(0, pos),
      hash: target.substring(pos + 1),
    };
  } else {
    return {
      path: target,
    };
  }
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

export function intoUIState(historyState: HistoryState, serverState: ServerState): UIState {
  switch (historyState.path) {
    case "/": {
      return {
        page: {
          type: PageType.Index,
        },
      };
    }

    case "/user": {
      return {
        page: {
          type: PageType.User,
        },
      };
    }

    case "/upload": {
      let id = historyState.params?.get("catalog");
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
          }
        };
      }

      id = historyState.params?.get("album");
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
          }
        };
      }

      return {
        page: {
          type: PageType.User,
        },
        overlay: {
          type: OverlayType.Upload,
        }
      };
    }

    case "/login": {
      let uiState = intoUIState(decodeHistoryState(historyState.params), serverState);
      uiState.overlay = {
        type: OverlayType.Login,
      };
      return uiState;
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
      }
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
      }
    };
  }

  return notfound(historyState);
}

export function fromUIState(uiState: Draft<UIState>): HistoryState {
  switch (uiState.overlay?.type) {
    case OverlayType.Upload: {
      let params = new Map();

      switch (uiState.page.type) {
        case PageType.Catalog: {
          params.set("catalog", uiState.page.catalog.id);
          break;
        }
        case PageType.Album: {
          params.set("album", uiState.page.album.id);
          break;
        }
      }

      return {
        path: "/upload",
        params,
      };
    }
    case OverlayType.Login: {
      let targetState: Draft<UIState> = {
        page: uiState.page,
        overlay: undefined,
      };

      return {
        path: "/login",
        params: encodeHistoryState(fromUIState(targetState)),
      };
    }
  }

  switch (uiState.page.type) {
    case PageType.Index: {
      return {
        path: "/",
      };
    }
    case PageType.User: {
      return {
        path: "/user",
      };
    }
    case PageType.Catalog: {
      return {
        path: `/catalog/${uiState.page.catalog.id}`,
      };
    }
    case PageType.Album: {
      return {
        path: `/album/${uiState.page.album.id}`,
      };
    }

    case PageType.NotFound: {
      return uiState.page.history;
    }
  }
}

export function getState(serverState: ServerState): UIState {
  return intoUIState(history.getState(), serverState);
}

export function pushState(uiState: Draft<UIState>): void {
  let historyState = fromUIState(uiState);
  let url = history.buildURL(historyState);
  console.log("pushState", uiState, historyState, url);
  history.pushState(historyState);
}

export function replaceState(uiState: Draft<UIState>): void {
  let historyState = fromUIState(uiState);
  let url = history.buildURL(historyState);
  console.log("replaceState", uiState, historyState, url);
  history.replaceState(historyState);
}
