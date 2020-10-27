import { pathToRegexp } from "path-to-regexp";

import { Join } from "../../model";
import { Catalog, Album } from "../api/highlevel";
import type { ServerState } from "../api/types";
import { OverlayType } from "../overlays/types";
import { PageType } from "../pages/types";
import actions from "../store/actions";
import type { StoreType, UIState } from "../store/types";
import { exception, ErrorCode } from "./exception";
import * as history from "./history";
import type { HistoryState } from "./history";
import { MediaLookupType } from "./medialookup";

function re(pattern: string): RegExp {
  return pathToRegexp(pattern, undefined, {
    sensitive: true,
    strict: true,
  });
}

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
  serverState: ServerState,
): UIState {
  if (!params) {
    return {
      page: {
        type: PageType.Root,
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

function notfound(historyState: HistoryState): UIState {
  return {
    page: {
      type: PageType.NotFound,
      history: historyState,
    },
  };
}

type PathMap = [
  RegExp,
  (serverState: ServerState, historyState: HistoryState, ...args: string[]) => UIState,
] | [
  string,
  (serverState: ServerState, historyState: HistoryState) => UIState,
];

const pathMap: PathMap[] = [
  [
    "/user",
    (serverState: ServerState, historyState: HistoryState): UIState => {
      if (!serverState.user) {
        return notfound(historyState);
      }

      return {
        page: {
          type: PageType.User,
        },
      };
    },
  ],

  [
    "/",
    (): UIState => {
      return {
        page: {
          type: PageType.Root,
        },
      };
    },
  ],

  [
    "/login",
    (serverState: ServerState, historyState: HistoryState): UIState => {
      return Object.assign({}, decodeTargetState(historyState.params, serverState), {
        overlay: {
          type: OverlayType.Login,
        },
      });
    },
  ],

  [
    re("/catalog/:id/search"),
    (serverState: ServerState, historyState: HistoryState, id: string): UIState => {
      let catalog = Catalog.safeFromState(serverState, id);
      if (!catalog) {
        return notfound(historyState);
      }

      return {
        page: {
          type: PageType.Search,
          catalog: catalog.ref(),
          query: {
            invert: false,
            type: "compound",
            join: Join.And,
            queries: [],
          },
        },
      };
    },
  ],

  [
    re("/catalog/:id"),
    (serverState: ServerState, historyState: HistoryState, id: string): UIState => {
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
    },
  ],

  [
    re("/album/:id"),
    (serverState: ServerState, historyState: HistoryState, id: string): UIState => {
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
    },
  ],

  [
    re("/media/:media"),
    (
      serverState: ServerState,
      historyState: HistoryState,
      media: string,
    ): UIState => {
      return {
        page: {
          type: PageType.Media,
          media,
          lookup: null,
        },
      };
    },
  ],

  [
    re("/catalog/:catalog/media/:media"),
    (
      serverState: ServerState,
      historyState: HistoryState,
      catalogId: string,
      mediaId: string,
    ): UIState => {
      let catalog = Catalog.safeFromState(serverState, catalogId);
      if (!catalog) {
        return notfound(historyState);
      }

      return {
        page: {
          type: PageType.Media,
          media: mediaId,
          lookup: {
            type: MediaLookupType.Catalog,
            catalog: catalog.ref(),
          },
        },
      };
    },
  ],

  [
    re("/album/:album/media/:media"),
    (
      serverState: ServerState,
      historyState: HistoryState,
      albumId: string,
      mediaId: string,
    ): UIState => {
      let album = Album.safeFromState(serverState, albumId);
      if (!album) {
        return notfound(historyState);
      }

      return {
        page: {
          type: PageType.Media,
          media: mediaId,
          lookup: {
            type: MediaLookupType.Album,
            album: album.ref(),
            recursive: true,
          },
        },
      };
    },
  ],
];

export function intoUIState(historyState: HistoryState, serverState: ServerState): UIState {
  for (let [pattern, callback] of pathMap) {
    if (typeof pattern == "string") {
      if (pattern == historyState.path) {
        return callback(serverState, historyState);
      }
    } else {
      let matches = pattern.exec(historyState.path);
      if (matches && matches[0].length == historyState.path.length) {
        return callback(serverState, historyState, ...matches.slice(1));
      }
    }
  }

  return notfound(historyState);
}

export function fromUIState(uiState: UIState): HistoryState {
  switch (uiState.overlay?.type) {
    case OverlayType.Login: {
      return history.buildState("/login", encodeTargetState(uiState));
    }
  }

  switch (uiState.page.type) {
    case PageType.Root: {
      return history.buildState("/");
    }
    case PageType.User: {
      return history.buildState("/user");
    }
    case PageType.Catalog: {
      return history.buildState(`/catalog/${uiState.page.catalog.id}`);
    }
    case PageType.Album: {
      return history.buildState(`/album/${uiState.page.album.id}`);
    }
    case PageType.Media: {
      switch (uiState.page.lookup?.type) {
        case MediaLookupType.Album:
          return history.buildState(
            `/album/${uiState.page.lookup.album.id}/media/${uiState.page.media}`,
          );
        case MediaLookupType.Catalog:
          return history.buildState(
            `/catalog/${uiState.page.lookup.catalog.id}/media/${uiState.page.media}`,
          );
        default:
          return history.buildState(`/media/${uiState.page.media}`);
      }
    }
    case PageType.Search: {
      return history.buildState(`/catalog/${uiState.page.catalog.id}/search`);
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
  let uiState = intoUIState(historyState, store.getState().serverState);

  history.addListener((newHistoryState: HistoryState): void => {
    historyState = newHistoryState;
    uiState = intoUIState(historyState, store.getState().serverState);
    store.dispatch(actions.navigate(uiState));
  });

  store.dispatch(actions.navigate(uiState));

  store.subscribe((): void => {
    let storeUIState = store.getState().ui;
    if (storeUIState === uiState) {
      return;
    }

    uiState = storeUIState;
    let newHistoryState = fromUIState(uiState);
    if (stateURLMatches(historyState, newHistoryState)) {
      history.replaceState(newHistoryState);
    } else {
      history.pushState(newHistoryState);
    }

    historyState = newHistoryState;
  });
}
