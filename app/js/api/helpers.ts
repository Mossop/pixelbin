import cookie from "cookie";
import { JsonDecoder } from "ts.data.json";

import { MappingDecoder } from "../utils/decoders";
import { exception, ErrorCode, ApiError, processException } from "../utils/exception";
import { Reference, isReference, APIItemBuilder, APIItemReference } from "./highlevel";
import { ApiMethod, HttpMethods, ApiErrorDataDecoder } from "./types";

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type MethodList = { [k in ApiMethod]: Method };

export type RequestPk<T> = Reference<T>;
export type ResponsePk<T> = Reference<T>;

type Decoder<T> = (response: Response) => Promise<T>;

export type Patch<D, T> = Partial<D> & {
  id: RequestPk<T>;
};

const API_ROOT = new URL("/api/", window.location.href);

// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
export const VoidDecoder: Decoder<void> = async (_: Response): Promise<void> => {};
export const BlobDecoder: Decoder<Blob> = (response: Response): Promise<Blob> => response.blob();
export function JsonDecoderDecoder<D>(decoder: JsonDecoder.Decoder<D>): Decoder<D> {
  return async (response: Response): Promise<D> => decoder.decodePromise(await response.json());
}

export function ResponsePkDecoder<T>(builder: APIItemBuilder<T>, name: string): JsonDecoder.Decoder<ResponsePk<T>> {
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
  public applyToHeaders(_: Headers): void {
    return;
  }

  public body(): BodyInit | null {
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

function* objectParams(data: object, prefix: string = ""): Generator<[string, string | Blob]> {
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
function* arrayParams(data: any[], prefix: string = ""): Generator<[string, string | Blob]> {
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
  private formData: FormData;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(data: any, decoder: Decoder<D>) {
    super(decoder);
    this.formData = new FormData();
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

    for (let [key, value] of items) {
      this.formData.append(key, value);
    }
  }

  public body(): BodyInit | null {
    return this.formData;
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

  public applyToHeaders(headers: Headers): void {
    headers.append("Content-Type", "application/json");
  }

  public body(): BodyInit | null {
    return this.data;
  }
}

export async function makeRequest<D>(path: ApiMethod, request: RequestData<D>): Promise<D> {
  let url = new URL(path, API_ROOT);
  request.applyToURL(url);

  let headers = new Headers();
  headers.append("X-CSRFToken", cookie.parse(document.cookie)["csrftoken"]);
  request.applyToHeaders(headers);

  let response;
  try {
    response = await fetch(url.href, {
      method: HttpMethods[path],
      headers,
      body: request.body(),
    });
  } catch (e) {
    exception(ErrorCode.RequestFailed);
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await ApiErrorDataDecoder.decodePromise(await response.json());
    } catch (e) {
      exception(ErrorCode.DecodeError);
    }
    processException(new ApiError(response.status, response.statusText, errorData));
  }

  try {
    return await request.decode(response);
  } catch (e) {
    console.error(e);
    exception(ErrorCode.DecodeError);
  }
}
