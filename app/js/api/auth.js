import { formRequest } from "./api";

export async function login(email, password) {
  let request = await formRequest("/login", {
    email,
    password,
  });

  if (request.ok) {
    return request.json();
  } else {
    throw new Error("Login failed");
  }
}
