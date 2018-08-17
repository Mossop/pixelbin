const API_ROOT = "/api";
const CSRF_TOKEN = document.querySelector("[name='csrfmiddlewaretoken']").value;

export function formRequest(path, options) {
  let formData = new FormData();
  formData.append("csrfmiddlewaretoken", CSRF_TOKEN);

  for (let key of Object.keys(options)) {
    formData.append(key, options[key]);
  }

  return fetch(API_ROOT + path, {
    method: "POST",
    body: formData,
  });
}
