import { decodeAPIError, APIError } from "./types";
import cookie from "cookie";
import { JsonDecoder } from "ts.data.json";
import { Mappable } from "../utils/maps";

const API_ROOT = new URL("/api/", window.location.href);

export type Patch<R extends Mappable> = Partial<R> & Mappable;

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface FormBody {
  data: FormData;
}

interface JSONBody {
  type: "application/json";
  data: string;
}

export function apiURL(url: string | URL): URL {
  if (url instanceof URL) {
    return url;
  }
  return new URL(url, API_ROOT);
}

export function buildFormBody(options: URLSearchParams | { [key: string]: string | Blob }): FormBody {
  let formData = new FormData();
  if (options instanceof URLSearchParams) {
    for (let [key, value] of options) {
      formData.append(key, value);
    }
  } else {
    for (let key of Object.keys(options)) {
      formData.append(key, options[key]);
    }
  }

  return {
    data: formData,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildJSONBody(data: any): JSONBody {
  return {
    type: "application/json",
    data: JSON.stringify(data),
  };
}

export type Body = JSONBody | FormBody;

export interface RequestParams {
  url: URL | string;
  method?: Method;
  body?: Body;
}

export async function baseRequest(params: RequestParams): Promise<Response> {
  const { method = "GET", body = undefined } = params;

  let url = apiURL(params.url);
  let headers = new Headers();
  headers.append("X-CSRFToken", cookie.parse(document.cookie)["csrftoken"]);
  if (body && "type" in body) {
    headers.append("Content-Type", body.type);
  }

  let response: Response;
  try {
    response = await fetch(url.href, {
      method,
      headers,
      body: body ? body.data : undefined,
    });
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

  if (!response.ok) {
    throw await decodeAPIError(response);
  } else {
    return response;
  }
}

export function buildGetURL(uri: URL | string, options: URLSearchParams | { [key: string]: string } = {}): URL {
  let url = apiURL(uri);

  if (options instanceof URLSearchParams) {
    for (let [key, value] of options) {
      url.searchParams.append(key, value);
    }
  } else {
    for (let key of Object.keys(options)) {
      url.searchParams.append(key, options[key]);
    }
  }

  return url;
}

type DecodeParams<R> = RequestParams & {
  decoder: JsonDecoder.Decoder<R>;
};

export async function request<R>(params: DecodeParams<R>): Promise<R> {
  let response = await baseRequest(params);

  try {
    let json = await response.json();
    let data: R = await params.decoder.decodePromise(json);
    return data;
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
}
