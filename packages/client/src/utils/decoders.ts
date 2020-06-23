import { MappingDecoder } from "pixelbin-utils";
import { JsonDecoder } from "ts.data.json";

import { Mappable, ReadonlyMapOf } from "./maps";
import { Func } from "./types";

export function ReadonlyMapDecoder<A extends Mappable>(
  decoder: JsonDecoder.Decoder<A>,
  name: string,
): JsonDecoder.Decoder<ReadonlyMapOf<A>> {
  return MappingDecoder<A[], ReadonlyMapOf<A>>(
    JsonDecoder.array(decoder, name),
    (arr: A[]): ReadonlyMap<string, A> => {
      let result = new Map<string, A>();
      for (let val of arr) {
        result.set(val.id, val);
      }
      return result;
    },
    `MapOf<${name}>`,
  );
}

type InterfaceFunctions<T> = ({[P in keyof T]: T[P] extends Func ? P : never })[keyof T];
type InterfaceProperties<T> = Omit<T, InterfaceFunctions<T>>;
