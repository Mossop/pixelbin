const API_ROOT = new URL("/api/", window.location.href);

export function getRequest(path, options = {}) {
  let url = new URL(path, API_ROOT);

  for (let key of Object.keys(options)) {
    url.searchParams.append(key, options[key]);
  }

  return fetch(url.href, {
    method: "GET",
  });
}

export async function postRequest(path, options = {}) {
  let cookie = await import(/* webpackChunkName: "cookie" */"cookie");

  let headers = new Headers();
  headers.append("X-CSRFToken", cookie.parse(document.cookie)["csrftoken"]);
  let url = new URL(path, API_ROOT);

  let formData = new FormData();
  for (let key of Object.keys(options)) {
    formData.append(key, options[key]);
  }

  return fetch(url.href, {
    method: "POST",
    body: formData,
    headers,
  });
}
