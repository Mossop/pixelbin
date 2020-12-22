import type { Draft } from "immer";
import { pathToRegexp } from "path-to-regexp";

import { Join } from "../../model";
import { Catalog, Album, SavedSearch } from "../api/highlevel";
import type { ServerState } from "../api/types";
import { DialogType } from "../dialogs/types";
import { PageType } from "../pages/types";
import Services from "../services";
import actions from "../store/actions";
import type { StoreType, UIState } from "../store/types";
import { exception, ErrorCode } from "./exception";
import * as history from "./history";
import type { HistoryState } from "./history";

type EncodedUIState = Omit<HistoryState, "state">;

function re(pattern: string): RegExp {
  return pathToRegexp(pattern, undefined, {
    sensitive: true,
    strict: true,
  });
}

function encodeTargetState(uiState: UIState): Map<string, string> | undefined {
  if (uiState.dialog === undefined) {
    // This would guarantee infinite recursion.
    exception(ErrorCode.InvalidState);
  }

  let target: UIState = Object.assign({}, uiState, {
    dialog: undefined,
  });

  let historyState = fromUIState(target);

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

  let historyState: EncodedUIState = {
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
  (serverState: ServerState, historyState: EncodedUIState, ...args: string[]) => UIState,
] | [
  string,
  (serverState: ServerState, historyState: EncodedUIState) => UIState,
];

const pathMap: PathMap[] = [
  [
    "/user",
    (serverState: ServerState, historyState: EncodedUIState): UIState => {
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
    (serverState: ServerState, historyState: EncodedUIState): UIState => {
      return Object.assign({}, decodeTargetState(historyState.params, serverState), {
        dialog: {
          type: DialogType.Login,
        },
      });
    },
  ],

  [
    re("/catalog/:id/search"),
    (serverState: ServerState, historyState: EncodedUIState, id: string): UIState => {
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
    (serverState: ServerState, historyState: EncodedUIState, id: string): UIState => {
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
    (serverState: ServerState, historyState: EncodedUIState, id: string): UIState => {
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
    re("/catalog/:catalog/media/:media"),
    (
      serverState: ServerState,
      historyState: EncodedUIState,
      catalogId: string,
      mediaId: string,
    ): UIState => {
      let catalog = Catalog.safeFromState(serverState, catalogId);
      if (!catalog) {
        return notfound(historyState);
      }

      return {
        page: {
          type: PageType.Catalog,
          catalog: catalog.ref(),
          selectedMedia: mediaId,
        },
      };
    },
  ],

  [
    re("/album/:album/media/:media"),
    (
      serverState: ServerState,
      historyState: EncodedUIState,
      albumId: string,
      mediaId: string,
    ): UIState => {
      let album = Album.safeFromState(serverState, albumId);
      if (!album) {
        return notfound(historyState);
      }

      return {
        page: {
          type: PageType.Album,
          album: album.ref(),
          selectedMedia: mediaId,
        },
      };
    },
  ],

  [
    re("/search/:search/media/:media"),
    (
      serverState: ServerState,
      historyState: EncodedUIState,
      searchId: string,
      mediaId: string,
    ): UIState => {
      let search = SavedSearch.safeFromState(serverState, searchId);
      if (!search) {
        return {
          page: {
            type: PageType.SharedSearch,
            search: searchId,
            selectedMedia: mediaId,
          },
        };
      }

      return {
        page: {
          type: PageType.SavedSearch,
          search: search.ref(),
          selectedMedia: mediaId,
        },
      };
    },
  ],

  [
    re("/search/:search"),
    (
      serverState: ServerState,
      historyState: EncodedUIState,
      searchId: string,
    ): UIState => {
      let search = SavedSearch.safeFromState(serverState, searchId);
      if (search) {
        return {
          page: {
            type: PageType.SavedSearch,
            search: SavedSearch.ref(searchId),
          },
        };
      } else {
        return {
          page: {
            type: PageType.SharedSearch,
            search: searchId,
          },
        };
      }
    },
  ],
];

export function intoUIState(historyState: EncodedUIState, serverState: ServerState): UIState {
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

export function fromUIState(uiState: UIState): EncodedUIState {
  switch (uiState.dialog?.type) {
    case DialogType.Login: {
      return history.buildState("/login", encodeTargetState(uiState));
    }
  }

  switch (uiState.page.type) {
    case PageType.Root: {
      return history.buildState("/");
    }
    case PageType.SavedSearch: {
      let path = `/search/${uiState.page.search.id}`;
      if (uiState.page.selectedMedia) {
        path += `/media/${uiState.page.selectedMedia}`;
      }
      return history.buildState(path);
    }
    case PageType.SharedSearch: {
      let path = `/search/${uiState.page.search}`;
      if (uiState.page.selectedMedia) {
        path += `/media/${uiState.page.selectedMedia}`;
      }
      return history.buildState(path);
    }
    case PageType.User: {
      return history.buildState("/user");
    }
    case PageType.Catalog: {
      let path = `/catalog/${uiState.page.catalog.id}`;
      if (uiState.page.selectedMedia) {
        path += `/media/${uiState.page.selectedMedia}`;
      }
      return history.buildState(path);
    }
    case PageType.Album: {
      let path = `/album/${uiState.page.album.id}`;
      if (uiState.page.selectedMedia) {
        path += `/media/${uiState.page.selectedMedia}`;
      }
      return history.buildState(path);
    }
    case PageType.Search: {
      let path = `/catalog/${uiState.page.catalog.id}/search`;
      if (uiState.page.selectedMedia) {
        path += `/media/${uiState.page.selectedMedia}`;
      }
      return history.buildState(path);
    }
    case PageType.NotFound: {
      return uiState.page.history;
    }
  }
}

export function getUIState(serverState: ServerState): UIState {
  return intoUIState(history.getState(), serverState);
}

function isPushedState(): boolean {
  return !!history.getState().state?.pushed;
}

export function pushUIState(state: UIState): Draft<UIState> {
  history.pushState({
    ...fromUIState(state),
    state: {
      pushed: true,
    },
  });
  return state as Draft<UIState>;
}

export function replaceUIState(state: UIState): Draft<UIState> {
  history.replaceState({
    ...fromUIState(state),
    state: {
      pushed: isPushedState(),
    },
  });
  return state as Draft<UIState>;
}

export function goBack(state: UIState): void {
  if (isPushedState()) {
    history.back();
    return;
  }

  void Services.store.then((store: StoreType): void => {
    store.dispatch(actions.replaceUIState(state));
  });
}

export function closeDialog(): void {
  if (isPushedState()) {
    history.back();
    return;
  }

  void Services.store.then((store: StoreType): void => {
    let {
      dialog,
      ...uiState
    } = store.getState().ui;
    store.dispatch(actions.replaceUIState(uiState));
  });
}

export function watchStore(store: StoreType): void {
  history.addListener((historyState: HistoryState): void => {
    let { serverState } = store.getState();
    store.dispatch(actions.setUIState(intoUIState(historyState, serverState)));
  });
}
