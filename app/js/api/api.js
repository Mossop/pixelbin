const API_ROOT = new URL("/api/", window.location.href);
const CSRF_TOKEN = document.querySelector("[name='csrfmiddlewaretoken']").value;

export function getRequest(path, options = {}) {
  let url = new URL(path, API_ROOT);

  for (let key of Object.keys(options)) {
    url.searchParams.append(key, options[key]);
  }

  return fetch(url.href, {
    method: "GET",
  });
}

export function postRequest(path, options = {}) {
  let url = new URL(path, API_ROOT);

  let formData = new FormData();
  formData.append("csrfmiddlewaretoken", CSRF_TOKEN);

  for (let key of Object.keys(options)) {
    formData.append(key, options[key]);
  }

  return fetch(url.href, {
    method: "POST",
    body: formData,
  });
}
