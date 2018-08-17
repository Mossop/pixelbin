import { getRequest, postRequest } from "./api";

export async function login(email, password) {
  let request = await postRequest("login", {
    email,
    password,
  });

  if (request.ok) {
    return request.json();
  } else {
    throw new Error("Login failed");
  }
}

export async function logout() {
  let request = await getRequest("logout");

  if (!request.ok) {
    throw new Error("Logout failed");
  }
}
