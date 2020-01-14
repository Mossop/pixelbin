import cookie from "cookie";
import { JsonDecoder } from "ts.data.json";

import { ApiMethod, HttpMethods } from "./types";
import { APIError, decodeAPIError } from "./errors";

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
export type MethodList = { [k in ApiMethod]: Method };

type Decoder<T> = (response: Response) => Promise<T>;

const API_ROOT = new URL("/api/", window.location.href);

// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
export const VoidDecoder: Decoder<void> = async (_: Response): Promise<void> => {};
export const BlobDecoder: Decoder<Blob> = (response: Response): Promise<Blob> => response.blob();
export function JsonDecoderDecoder<D>(decoder: JsonDecoder.Decoder<D>): Decoder<D> {
  return async (response: Response): Promise<D> => decoder.decodePromise(await response.json());
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

export class QueryRequestData<D> extends RequestData<D> {
  public constructor(private data: object | undefined, decoder: Decoder<D>) {
    super(decoder);
  }

  public applyToURL(url: URL): void {
    if (!this.data) {
      return;
    }

    for (let [key, value] of Object.entries(this.data)) {
      url.searchParams.append(key, value);
    }
  }
}

export class FormRequestData<D> extends RequestData<D> {
  private formData: FormData;

  public constructor(data: object | undefined, decoder: Decoder<D>) {
    super(decoder);
    this.formData = new FormData();
    if (!data) {
      return;
    }
    for (let [key, value] of Object.entries(data)) {
      this.formData.append(key, value);
    }
  }

  public body(): BodyInit | null {
    return this.formData;
  }
}

export class JsonRequestData<D> extends RequestData<D> {
  private data: string | null;

  public constructor(data: object | undefined, decoder: Decoder<D>) {
    super(decoder);
    if (!data) {
      this.data = null;
    } else {
      this.data = JSON.stringify(data);
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

  try {
    let response = await fetch(url.href, {
      method: HttpMethods[path],
      headers,
      body: request.body(),
    });

    if (!response.ok) {
      throw await decodeAPIError(response);
    }

    try {
      return await request.decode(response);
    } catch (e) {
      let error: APIError = {
        status: 0,
        statusText: "Response parse failed",
        code: "invalid-response",
        args: {
          detail: String(e),
        },
      };
      throw error;
    }
  } catch (e) {
    let error: APIError = {
      status: 0,
      statusText: "Request failed",
      code: "request-failed",
      args: {
        detail: String(e),
      }
    };
    throw error;
  }
}
