import { buildFormBody, request } from "./api";
import { ServerStateDecoder, ServerState } from "../types";

export async function login(email: string, password: string): Promise<ServerState> {
  let response = await request("login", "POST", buildFormBody({
    email,
    password,
  }));

  if (response.ok) {
    return ServerStateDecoder.decodePromise(await response.json());
  } else {
    throw new Error("Login failed");
  }
}

export async function signup(email: string, fullname: string, password: string): Promise<ServerState> {
  let response = await request("user/create", "PUT", buildFormBody({
    email,
    fullname,
    password,
  }));

  if (response.ok) {
    return ServerStateDecoder.decodePromise(await response.json());
  } else {
    throw new Error("Signup failed");
  }
}

export async function logout(): Promise<ServerState> {
  let response = await request("logout", "POST");

  if (response.ok) {
    return ServerStateDecoder.decodePromise(await response.json());
  } else {
    throw new Error("Logout failed");
  }
}
