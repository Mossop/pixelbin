import { Api } from "../../../model";
import { request } from "./api";
import { ServerState, serverStateIntoState } from "./types";

export async function state(): Promise<ServerState> {
  let state = await request(Api.Method.State);
  return serverStateIntoState(state);
}

export async function login(email: string, password: string): Promise<ServerState> {
  let state = await request(Api.Method.Login, {
    email,
    password,
  });
  return serverStateIntoState(state);
}

export async function logout(): Promise<ServerState> {
  let state = await request(Api.Method.Logout);
  return serverStateIntoState(state);
}

export interface SignupRequest {
  email: string;
  fullname: string;
  password: string;
}

export async function signup(_data: SignupRequest): Promise<ServerState> {
  throw new Error("Not implemented");
}
