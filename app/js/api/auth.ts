import { getRequest, postRequest } from "./api";
import { ServerStateDecoder, ServerState } from "../types";

export async function login(email: string, password: string): Promise<ServerState> {
  let request = await postRequest("login", {
    email,
    password,
  });

  if (request.ok) {
    return ServerStateDecoder.decodePromise(await request.json());
  } else {
    throw new Error("Login failed");
  }
}

export async function signup(email: string, fullName: string, password: string): Promise<ServerState> {
  let request = await postRequest("signup", {
    email,
    fullName: fullName,
    password,
  });

  if (request.ok) {
    return ServerStateDecoder.decodePromise(await request.json());
  } else {
    throw new Error("Signup failed");
  }
}

export async function logout(): Promise<ServerState> {
  let request = await getRequest("logout");

  if (request.ok) {
    return ServerStateDecoder.decodePromise(await request.json());
  } else {
    throw new Error("Logout failed");
  }
}
