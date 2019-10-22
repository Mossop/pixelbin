import { decodeAPIError, APIError } from "./types";

const API_ROOT = new URL("/api/", window.location.href);

export type Method = "GET" | "POST" | "PUT" | "DELETE";

interface FormBody {
  data: FormData;
}

interface JSONBody {
  type: "application/json";
  data: string;
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

export async function request(url: URL | string, method: Method = "POST", body?: Body): Promise<Response> {
  let cookie = await import(/* webpackChunkName: "cookie" */ "cookie");

  let uri: URL;
  if (url instanceof URL) {
    uri = url;
  } else {
    uri = new URL(url, API_ROOT);
  }

  let headers = new Headers();
  headers.append("X-CSRFToken", cookie.parse(document.cookie)["csrftoken"]);
  if (body && "type" in body) {
    headers.append("Content-Type", body.type);
  }

  let response: Response;
  try {
    response = await fetch(uri.href, {
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

export function getRequest(path: string, options: URLSearchParams | { [key: string]: string } = {}): Promise<Response> {
  let url = new URL(path, API_ROOT);

  if (options instanceof URLSearchParams) {
    for (let [key, value] of options) {
      url.searchParams.append(key, value);
    }
  } else {
    for (let key of Object.keys(options)) {
      url.searchParams.append(key, options[key]);
    }
  }

  return request(url, "GET");
}
