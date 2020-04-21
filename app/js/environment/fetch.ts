export default function(
  input: RequestInfo,
  init?: RequestInit,
  body?: string | Record<string, string | Blob> | null,
): Promise<Response> {
  if (body) {
    if (!init) {
      init = {};
    }

    if (typeof body == "string") {
      init.body = body;
    } else {
      let data = new FormData();
      for (let [key, value] of Object.entries(body)) {
        data.append(key, value);
      }
      init.body = data;
    }
  }

  return fetch(input, init);
}
