import type { Result } from "ts.data.json";
import { JsonDecoder, Ok, ok, err } from "ts.data.json";

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

export const NumericDecoder = oneOf([
  JsonDecoder.number,
  MappingDecoder(JsonDecoder.string, (str: string): number => {
    if (NUMERIC.exec(str)) {
      return parseInt(str);
    }

    throw new Error(`'${str}' is not a number.`);
  }, "number"),
], "number");

export function oneOf<D>(
  decoders: JsonDecoder.Decoder<D>[],
  decoderName: string,
): JsonDecoder.Decoder<D> {
  return new JsonDecoder.Decoder<D>((json: unknown): Result<D> => {
    let errors: string[] = [];
    for (let decoder of decoders) {
      let result = decoder.decode(json);
      if (result.isOk()) {
        return result;
      }
      errors.push(result.error);
    }

    let errorMessages = `  ${errors.join("\n  ")}`;
    return err<D>(
      `Error to decoding ${decoderName}. All of the provided decoders failed:\n${errorMessages}`,
    );
  });
}
