import { buildJSONBody, request } from "./api";
import { ServerStateDecoder, ServerData } from "./types";

export async function login(email: string, password: string): Promise<ServerData> {
  return request({
    url: "login",
    method: "POST",
    body: buildJSONBody({
      email,
      password,
    }),
    decoder: ServerStateDecoder,
  });
}

export async function signup(email: string, fullname: string, password: string): Promise<ServerData> {
  return request({
    url: "user/create",
    method: "PUT",
    body: buildJSONBody({
      email,
      fullname,
      password,
    }),
    decoder: ServerStateDecoder,
  });
}

export async function logout(): Promise<ServerData> {
  return request({
    url: "logout",
    method: "POST",
    decoder: ServerStateDecoder,
  });
}
