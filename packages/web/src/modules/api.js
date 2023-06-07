/**
 * Performs a POST request with a JSON body.
 *
 * @param {string} path
 * @param {any} body
 */
async function post(path, body) {
  let response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return response.json();
  }

  try {
    throw new Error(await response.json());
  } catch (e) {
    throw new Error(response.statusText);
  }
}

/**
 * Logs in to the PixelBin service.
 *
 * @param {string} email
 * @param {string} password
 */
export async function login(email, password) {
  return post("/api/login", { email, password });
}
