import { JsonDecoder } from "ts.data.json";
export * from "./api";
export * from "./store";

export interface Paths {
  static: string;
}

export const PathsDecoder = JsonDecoder.object<Paths>(
  {
    static: JsonDecoder.string,
  },
  "Paths"
);
