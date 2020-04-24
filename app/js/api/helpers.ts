import { parse as parseCookie } from "cookie";
import { JsonDecoder } from "ts.data.json";

import { appURL, Url } from "../context";
import { fetch, document } from "../environment";
import { MappingDecoder } from "../utils/decoders";
import { exception, ErrorCode, ApiError } from "../utils/exception";
import { isReference, APIItemReference } from "./highlevel";
import type { Reference, APIItemBuilder } from "./highlevel";

export function pullParam<O, K extends keyof O>(data: O, param: K): O[K] {
  let val = data[param];
  delete data[param];
  return val;
}

export type RequestPk<T> = Reference<T>;
export type ResponsePk<T> = Reference<T>;

type Decoder<T> = (response: Response) => Promise<T>;

export type Patch<D, T> = Partial<D> & {
  id: RequestPk<T>;
};

type EncodedObject<O> = {
  [K in keyof O]: Encoded<O[K]>;
};

export type Encoded<T> =
  T extends ReadonlyMap<string, infer V> ? Encoded<V>[] :
    // eslint-disable-next-line @typescript-eslint/array-type
    T extends ReadonlyArray<infer V> ? Encoded<V>[] :
      T extends object ? EncodedObject<T> : T;

// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
export const VoidDecoder: Decoder<void> = async (_: Response): Promise<void> => {};
export const BlobDecoder: Decoder<Blob> = (response: Response): Promise<Blob> => response.blob();
export function JsonDecoderDecoder<D>(decoder: JsonDecoder.Decoder<D>): Decoder<D> {
  return async (response: Response): Promise<D> => decoder.decodePromise(await response.json());
}

export function ResponsePkDecoder<T>(
  builder: APIItemBuilder<T>,
  name: string,
): JsonDecoder.Decoder<ResponsePk<T>> {
  return MappingDecoder(JsonDecoder.string, (data: string): Reference<T> => {
    return new APIItemReference(data, builder);
  }, `Reference<${name}>`);
}

export class RequestData<D> {
  public constructor(private decoder: Decoder<D>) {
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public applyToURL(_: URL): void {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public applyToHeaders(_: Record<string, string>): void {
    return;
  }

  public body(): string | Record<string, string | Blob> | null {
    return null;
  }

  public decode(response: Response): Promise<D> {
    return this.decoder(response);
  }
}

type QueryType = Record<string, boolean | string | number> | null | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObject = (data: any): boolean => !(data instanceof Blob) && typeof data == "object";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isArray = (data: any): boolean => Array.isArray(data);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function intoString(data: any): string {
  if (isReference(data)) {
    return data.id;
  }

  return String(data);
}

function *objectParams(data: object, prefix: string = ""): Generator<[string, string | Blob]> {
  for (let [key, value] of Object.entries(data)) {
    let param = `${prefix}${key}`;
    if (isReference(value)) {
      yield [param, value.id];
    } else if (isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      yield* arrayParams(value, `${param}`);
    } else if (isObject(value)) {
      yield* objectParams(value, `${param}.`);
    } else if (value instanceof Blob) {
      yield [param, value];
    } else {
      yield [param, intoString(value)];
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function *arrayParams(data: any[], prefix: string = ""): Generator<[string, string | Blob]> {
  // For reference types we can just send a list with the same field name.
  if (data.every(isReference)) {
    for (let ref of data) {
      yield [prefix, ref.id];
    }
    return;
  }

  for (let [index, value] of data.entries()) {
    let param = `${prefix}[${index}]`;

    if (isReference(value)) {
      yield [param, value.id];
    } else if (isArray(value)) {
      yield* arrayParams(value, param);
    } else if (isObject(value)) {
      yield* objectParams(value, param);
    } else if (value instanceof Blob) {
      yield [param, value];
    } else {
      yield [param, intoString(value)];
    }
  }
}

export class QueryRequestData<D> extends RequestData<D> {
  public constructor(private data: QueryType, decoder: Decoder<D>) {
    super(decoder);
  }

  public applyToURL(url: URL): void {
    if (!this.data) {
      return;
    }

    for (let [key, value] of Object.entries(this.data)) {
      url.searchParams.append(key, intoString(value));
    }
  }
}

export class FormRequestData<D> extends RequestData<D> {
  private formData: Record<string, string | Blob>;
  private json: string | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(data: any, decoder: Decoder<D>) {
    super(decoder);
    this.formData = {};
    if (data === null || data === undefined) {
      return;
    }

    let items: Generator<[string, string | Blob]>;
    if (isArray(data)) {
      items = arrayParams(data);
    } else if (isObject(data)) {
      items = objectParams(data);
    } else {
      exception(ErrorCode.InvalidData, {
        detail: `Unexpected data type ${typeof data}`,
      });
    }

    let canJSON = true;

    for (let [key, value] of items) {
      this.formData[key] = value;
      if (value instanceof Blob) {
        canJSON = false;
      }
    }

    if (canJSON) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.json = JSON.stringify(data, (_key: string, value: any): any => {
        if (isReference(value)) {
          return value.id;
        }

        return value;
      });
    }
  }

  public applyToHeaders(headers: Record<string, string>): void {
    if (this.json) {
      headers["Content-Type"] = "application/json";
    }
  }

  public body(): string | Record<string, string | Blob> | null {
    return this.json ?? this.formData;
  }
}

export class JsonRequestData<D> extends RequestData<D> {
  private data: string | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(data: any, decoder: Decoder<D>) {
    super(decoder);
    if (!data) {
      this.data = null;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.data = JSON.stringify(data, (_key: string, value: any): any => {
        if (isReference(value)) {
          return value.id;
        }

        return value;
      });
    }
  }

  public applyToHeaders(headers: Record<string, string>): void {
    headers["Content-Type"] = "application/json";
  }

  public body(): string | Record<string, string | Blob> | null {
    return this.data;
  }
}

export async function makeRequest<D>(
  method: string,
  path: string,
  request: RequestData<D>,
): Promise<D> {
  let url = appURL(Url.API, path);
  request.applyToURL(url);

  let headers: Record<string, string> = {};
  headers["X-CSRFToken"] = parseCookie(document.cookie)["csrftoken"];
  request.applyToHeaders(headers);

  let response: Response;
  try {
    response = await fetch(url.href, {
      method,
      headers,
    }, request.body());
  } catch (e) {
    exception(ErrorCode.RequestFailed, undefined, e);
  }

  if (!response.ok) {
    let errorData;
    try {
      const { ApiErrorDataDecoder } = await import(/* webpackChunkName: "api" */".");
      errorData = await ApiErrorDataDecoder.decodePromise(await response.json());
    } catch (e) {
      exception(ErrorCode.DecodeError, undefined, e);
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  try {
    return await request.decode(response);
  } catch (e) {
    exception(ErrorCode.DecodeError, undefined, e);
  }
}
