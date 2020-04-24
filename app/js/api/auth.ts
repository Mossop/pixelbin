import { ApiMethod } from ".";
import type { ServerData, UserCreateData } from ".";
import { request } from "./api";

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
