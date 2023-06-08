/**
 * Performs a POST request with an optional JSON body.
 *
 * @param {string} path
 * @param {any} body
 */
async function post(path, body = undefined) {
  let options = {
    method: "POST",
  };

  if (body) {
    options.headers = {
      "Content-Type": "application/json",
    };
    options.body = JSON.stringify(body);
  }

  let response = await fetch(path, options);

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

/**
 * Logs out of the PixelBin service.
 */
export async function logout() {
  return post("/api/logout");
}
