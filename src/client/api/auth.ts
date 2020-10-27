import type { Api } from "../../model";
import { Method } from "../../model";
import { request } from "./api";
import type { ServerState } from "./types";
import { serverStateIntoState } from "./types";

export async function state(): Promise<ServerState> {
  let state = await request(Method.State);
  return serverStateIntoState(state);
}

export async function login(email: string, password: string): Promise<ServerState> {
  let state = await request(Method.Login, {
    email,
    password,
  });
  return serverStateIntoState(state);
}

export async function logout(): Promise<ServerState> {
  let state = await request(Method.Logout);
  return serverStateIntoState(state);
}

export async function signup(data: Api.SignupRequest): Promise<ServerState> {
  let state = await request(Method.Signup, data);
  return serverStateIntoState(state);
}
