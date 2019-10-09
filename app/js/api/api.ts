const API_ROOT = new URL("/api/", window.location.href);

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

  return fetch(url.href, {
    method: "GET",
  });
}

export async function postRequest(path: string, options: URLSearchParams | { [key: string]: string } = {}): Promise<Response> {
  let cookie = await import(/* webpackChunkName: "cookie" */ "cookie");

  let headers = new Headers();
  headers.append("X-CSRFToken", cookie.parse(document.cookie)["csrftoken"]);
  let url = new URL(path, API_ROOT);

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

  return fetch(url.href, {
    method: "POST",
    body: formData,
    headers,
  });
}

export async function postJSONRequest(path: string, json: any): Promise<Response> {
  let cookie = await import(/* webpackChunkName: "cookie" */ "cookie");

  let headers = new Headers();
  headers.append("X-CSRFToken", cookie.parse(document.cookie)["csrftoken"]);
  headers.append("Content-Type", "application/json");
  let url = new URL(path, API_ROOT);

  return fetch(url.href, {
    method: "POST",
    body: JSON.stringify(json),
    headers,
  });
}

export function getAPIPath(path: string): URL {
  return new URL(path, API_ROOT);
}
