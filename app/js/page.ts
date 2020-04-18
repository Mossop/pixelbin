import { JsonDecoder } from "ts.data.json";

import { ServerDataDecoder, ServerData } from "./api/types";
import { decode } from "./utils/decoders";

export interface Paths {
  readonly static: string;
}

export const PathsDecoder = JsonDecoder.object<Paths>(
  {
    static: JsonDecoder.string,
  },
  "Paths",
);

function decodePaths(): Paths {
  let pathsElement = document.getElementById("paths");
  if (pathsElement?.textContent) {
    try {
      return decode(PathsDecoder, JSON.parse(pathsElement.textContent));
    } catch (e) {
      console.error(e);
    }
  }
  return {
    static: "/static/",
  };
}

export const paths = decodePaths();

export function decodeServerState(): ServerData {
  let stateElement = document.getElementById("initial-state");
  if (stateElement?.textContent) {
    try {
      return decode(ServerDataDecoder, JSON.parse(stateElement.textContent));
    } catch (e) {
      console.error(e);
    }
  }

  return { user: null };
}
