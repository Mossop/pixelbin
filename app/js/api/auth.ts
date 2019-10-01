import { getRequest, postRequest } from "./api";
import { UserStateDecoder, UserState } from "../types";

export async function login(email: string, password: string): Promise<UserState> {
  let request = await postRequest("login", {
    email,
    password,
  });

  if (request.ok) {
    return UserStateDecoder.decodePromise(await request.json());
  } else {
    throw new Error("Login failed");
  }
}

export async function logout(): Promise<UserState> {
  let request = await getRequest("logout");

  if (request.ok) {
    return UserStateDecoder.decodePromise(await request.json());
  } else {
    throw new Error("Logout failed");
  }
}
