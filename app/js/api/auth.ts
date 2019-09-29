import { getRequest, postRequest } from "./api";
import { StateDecoder, State } from "./types";

export async function login(email: string, password: string): Promise<State> {
  let request = await postRequest("login", {
    email,
    password,
  });

  if (request.ok) {
    return StateDecoder.decodePromise(await request.json());
  } else {
    throw new Error("Login failed");
  }
}

export async function logout(): Promise<State> {
  let request = await getRequest("logout");

  if (request.ok) {
    return StateDecoder.decodePromise(await request.json());
  } else {
    throw new Error("Logout failed");
  }
}
