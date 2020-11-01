import type { Draft } from "immer";

import { Method } from "../../model";
import { request } from "./api";
import type { ServerState } from "./types";
import { serverStateIntoState } from "./types";

export async function state(): Promise<ServerState> {
  let state = await request(Method.State);
  return serverStateIntoState(state);
}

export async function login(email: string, password: string): Promise<Draft<ServerState>> {
  let state = await request(Method.Login, {
    email,
    password,
  });
  return serverStateIntoState(state);
}

export async function logout(): Promise<Draft<ServerState>> {
  let state = await request(Method.Logout);
  return serverStateIntoState(state);
}

export async function signup(
  email: string,
  password: string,
  fullname: string,
): Promise<Draft<ServerState>> {
  return request(Method.Signup, {
    email,
    fullname,
    password,
  }).then(serverStateIntoState);
}
