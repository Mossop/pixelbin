import { Draft } from "immer";
import { Orientation } from "media-metadata";
import moment, { ISO_8601, Moment } from "moment";
import { JsonDecoder, Ok, Result, ok, err } from "ts.data.json";

import { exception, ErrorCode } from "./exception";
import { Mappable, MapOf } from "./maps";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decode<A>(decoder: JsonDecoder.Decoder<A>, data: any): A {
  let result = decoder.decode(data);
  if (result instanceof Ok) {
    return result.value;
  }
  exception(ErrorCode.DecodeError, {
    error: result.error,
  });
}

export function MappingDecoder<A, B>(
  decoder: JsonDecoder.Decoder<A>,
  mapper: (data: A) => B,
  name: string,
): JsonDecoder.Decoder<B> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new JsonDecoder.Decoder<B>((json: any): Result<B> => {
    let result = decoder.decode(json);
    if (result instanceof Ok) {
      try {
        return ok<B>(mapper(result.value));
      } catch (e) {
        return err<B>(`Error decoding ${name}: ${e}`);
      }
    } else {
      return err<B>(result.error);
    }
  });
}

export function SortedDecoder<A>(
  decoder: JsonDecoder.Decoder<A>,
  compare: undefined | ((a: A, b: A) => number),
  name: string,
): JsonDecoder.Decoder<A[]> {
  return MappingDecoder(
    JsonDecoder.array(decoder, `${name}[]`),
    (arr: A[]): A[] => {
      arr.sort(compare);
      return arr;
    },
    `${name}[]`,
  );
}

export const DateDecoder = MappingDecoder(
  JsonDecoder.string,
  (str: string): Moment => moment(str, ISO_8601),
  "Moment",
);
export const OrientationDecoder = MappingDecoder(
  JsonDecoder.number,
  (num: number): Orientation => num,
  "Orientation",
);
export function EnumDecoder<F, T>(
  decoder: JsonDecoder.Decoder<F>,
  name: string,
): JsonDecoder.Decoder<T> {
  return MappingDecoder<F, T>(decoder, (data: F): T => data as unknown as T, name);
}

export function MapDecoder<A extends Mappable>(
  decoder: JsonDecoder.Decoder<Draft<A>>,
  name: string,
): JsonDecoder.Decoder<Draft<MapOf<A>>> {
  return MappingDecoder<Draft<A[]>, Draft<MapOf<A>>>(
    JsonDecoder.array(decoder, name),
    (arr: Draft<A[]>): Map<string, Draft<A>> => {
      let result: Map<string, Draft<A>> = new Map();
      for (let val of arr) {
        result.set(val.id, val);
      }
      return result;
    },
    `MapOf<${name}>`,
  );
}

type InterfaceFunctions<T> = ({[P in keyof T]: T[P] extends Function ? P : never })[keyof T];
type InterfaceProperties<T> = Omit<T, InterfaceFunctions<T>>;

export class Decodable<T> {
  public constructor(obj: InterfaceProperties<T>) {
    Object.assign(this, obj);
  }
}

export function ClassDecoder<C>(
  cls: new(obj: InterfaceProperties<C>) => C,
  decoders: JsonDecoder.DecoderObject<InterfaceProperties<C>>,
  decoderName: string,
): JsonDecoder.Decoder<Draft<C>> {
  return MappingDecoder(
    JsonDecoder.object(decoders, decoderName),
    (data: InterfaceProperties<C>): Draft<C> => {
      return new cls(data) as Draft<C>;
    },
    decoderName,
  );
}
