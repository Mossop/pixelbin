"use server";

import { clearSession, session, setSession } from "./session";
import { LoginResponse, State } from "./types";

const GET: RequestInit = { method: "GET" };
const POST: RequestInit = { method: "POST" };

const DEEP_OPTIONS = ["headers", "next"];

function authenticated(): RequestInit {
  let token = session();

  if (!token) {
    throw new Error("Not yet authenticated");
  }

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

function json(data: object): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

async function rawApiCall<T>(
  path: string,
  ...options: RequestInit[]
): Promise<T> {
  let init = { ...GET };

  for (let option of options) {
    for (let [key, value] of Object.entries(option)) {
      if (key in init && DEEP_OPTIONS.includes(key)) {
        // @ts-ignore
        Object.assign(init[key], value);
      } else {
        // @ts-ignore
        init[key] = value;
      }
    }
  }

  let response = await fetch(`${process.env.PXL_API_SERVER}${path}`, init);

  if (response.ok) {
    return response.json();
  } else {
    try {
      throw new Error(await response.json());
    } catch (e) {
      throw new Error(response.statusText);
    }
  }
}

async function apiCall<T>(path: string, ...options: RequestInit[]): Promise<T> {
  return rawApiCall(path, authenticated(), ...options);
}

export async function login(email: string, password: string) {
  let response = await rawApiCall<LoginResponse>(
    "/api/login",
    POST,
    json({
      email,
      password,
    }),
    { cache: "no-store" },
  );

  if (response.token) {
    setSession(response.token);
  }
}

export async function logout() {
  if (session()) {
    apiCall("/api/logout", POST, { cache: "no-store" });
  }

  clearSession();
}

export async function state(): Promise<State | undefined> {
  if (session()) {
    try {
      return await apiCall<State>("/api/state");
    } catch (e) {
      console.error(e);
    }
  }

  return undefined;
}
