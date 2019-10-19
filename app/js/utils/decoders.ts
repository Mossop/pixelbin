import { JsonDecoder, Ok, Result, ok, err } from "ts.data.json";
import moment from "moment";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decode<A>(decoder: JsonDecoder.Decoder<A>, data: any): A {
  let result = decoder.decode(data);
  if (result instanceof Ok) {
    return result.value;
  }
  throw new Error(result.error);
}

function MappingDecoder<A, B>(decoder: JsonDecoder.Decoder<A>, mapper: (data: A) => B, name: string): JsonDecoder.Decoder<B> {
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

export function OptionalDecoder<A>(decoder: JsonDecoder.Decoder<A>, name: string): JsonDecoder.Decoder<undefined | A> {
  return JsonDecoder.oneOf([JsonDecoder.isNull(undefined), JsonDecoder.isUndefined(undefined), decoder], `${name}?`);
}

export function SortedDecoder<A>(decoder: JsonDecoder.Decoder<A>, compare: undefined | ((a: A, b: A) => number), name: string): JsonDecoder.Decoder<A[]> {
  return MappingDecoder(
    JsonDecoder.array(decoder, `${name}[]`),
    (arr: A[]) => {
      arr.sort(compare);
      return arr;
    },
    `${name}[]`
  );
}

export const DateDecoder = MappingDecoder(JsonDecoder.string, (str: string) => moment(str, moment.ISO_8601), "Moment");

interface Mappable {
  id: string;
}

export interface Mapped<R> {
  [prop: string]: R;
}

export function MapDecoder<A extends Mappable>(decoder: JsonDecoder.Decoder<A>, name: string): JsonDecoder.Decoder<Readonly<Mapped<A>>> {
  return MappingDecoder<A[], Mapped<A>>(
    JsonDecoder.array(decoder, name),
    (arr: A[]) => {
      let result: Mapped<A> = {};
      for (let val of arr) {
        result[val.id] = val;
      }
      return result;
    },
    `Map<string, ${name}>`
  );
}