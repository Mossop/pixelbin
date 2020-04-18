import { request } from "./api";
import { ApiMethod } from "./types";
import type { ServerData, UserCreateData } from "./types";

export function state(): Promise<ServerData> {
  return request(ApiMethod.State);
}

export function login(email: string, password: string): Promise<ServerData> {
  return request(ApiMethod.Login, {
    email,
    password,
  });
}

export function signup(data: UserCreateData): Promise<ServerData> {
  return request(ApiMethod.UserCreate, data);
}

export function logout(): Promise<ServerData> {
  return request(ApiMethod.Logout);
}
