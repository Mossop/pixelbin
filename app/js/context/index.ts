import { JsonDecoder } from "ts.data.json";

import { ServerData, ServerDataDecoder } from "../api";
import { document, URL } from "../environment";
import { decode, MappingDecoder } from "../utils/decoders";

export enum Url {
  Root = "root",
  Static = "static",
  API = "api",
  L10n = "l10n",
}

export interface Paths {
  readonly [Url.Root]: URL;
  readonly [Url.Static]?: URL;
  readonly [Url.API]?: URL;
  readonly [Url.L10n]?: URL;
}

let paths: Paths | undefined = undefined;

const URLDecoder = MappingDecoder(JsonDecoder.string, (data: string): URL => {
  return new URL(data, document.URL);
}, "URL");

export const PathsDecoder = JsonDecoder.object<Paths>(
  {
    [Url.Root]: URLDecoder,
    [Url.Static]: JsonDecoder.optional(URLDecoder),
    [Url.API]: JsonDecoder.optional(URLDecoder),
    [Url.L10n]: JsonDecoder.optional(URLDecoder),
  },
  "Paths",
);

function decodePaths(): Paths {
  try {
    let pathsElement = document.getElementById("paths");
    if (pathsElement?.textContent) {
      return decode(PathsDecoder, JSON.parse(pathsElement.textContent));
    }
  } catch (e) {
    console.error(e);
  }

  return {
    [Url.Root]: new URL("/", document.URL),
  };
}

function url(paths: Paths, key: Url): URL {
  switch (key) {
    case Url.Root:
      return paths[Url.Root];
    case Url.Static:
      return paths[key] ?? new URL("static/", paths[Url.Root]);
    case Url.API:
      return paths[key] ?? new URL("api/", paths[Url.Root]);
    case Url.L10n:
      return paths[key] ?? new URL("l10n/", url(paths, Url.Static));
  }
}

export function appURL(key: Url, relative?: string): URL {
  if (!paths) {
    paths = decodePaths();
  }

  let base = url(paths, key);

  if (relative) {
    return new URL(relative, base);
  }

  return base;
}

export function initialServerState(): ServerData {
  let stateElement = document.getElementById("initial-state");
  if (stateElement?.textContent) {
    try {
      return decode(ServerDataDecoder, JSON.parse(stateElement.textContent));
    } catch (e) {
      console.error(e);
    }
  } else {
    console.error("Missing initial state.");
  }

  return { user: null };
}

export function appContainer(): HTMLElement | null {
  return document.getElementById("app");
}
