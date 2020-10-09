import { JsonDecoder, Ok, Result, ok, err } from "ts.data.json";

import { parseDateTime } from "./datetime";

export function decode<A>(decoder: JsonDecoder.Decoder<A>, data: unknown): A {
  let result = decoder.decode(data);
  if (result instanceof Ok) {
    return result.value;
  }
  throw result.error;
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

export const DateDecoder = MappingDecoder(JsonDecoder.string, parseDateTime, "DateTime");

export function EnumDecoder<F, T>(
  decoder: JsonDecoder.Decoder<F>,
  name: string,
): JsonDecoder.Decoder<T> {
  return MappingDecoder<F, T>(decoder, (data: F): T => data as unknown as T, name);
}

const NUMERIC = /^-?\d+$/;

export const NumericDecoder = JsonDecoder.oneOf([
  JsonDecoder.number,
  MappingDecoder(JsonDecoder.string, (str: string): number => {
    if (NUMERIC.exec(str)) {
      return parseInt(str);
    }

    throw new Error(`'${str}' is not a number.`);
  }, "number"),
], "number");
