const API_ROOT = new URL("/api/", window.location.href);

export type Method = "GET" | "POST" | "PUT";

export function buildFormBody(options: URLSearchParams | { [key: string]: string }): FormData {
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

  return formData;
}

export function buildJSONBody(data: any): string {
  return JSON.stringify(data);
}

export async function request(url: URL | string, method: Method = "POST", body?: FormData | string): Promise<Response> {
  let cookie = await import(/* webpackChunkName: "cookie" */ "cookie");

  let uri: URL;
  if (url instanceof URL) {
    uri = url;
  } else {
    uri = new URL(url, API_ROOT);
  }

  let headers = new Headers();
  headers.append("X-CSRFToken", cookie.parse(document.cookie)["csrftoken"]);

  return fetch(uri.href, {
    method,
    body,
    headers,
  });
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
