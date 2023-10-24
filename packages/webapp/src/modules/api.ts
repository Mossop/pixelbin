"use server";

import { clearSession, session, setSession } from "./session";

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

async function call(path: string, ...options: RequestInit[]): Promise<any> {
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

export async function login(email: string, password: string) {
  let response = await fetch(`${process.env.PXL_API_SERVER}/api/login`, {
    cache: "no-store",
    ...POST,
    ...json({
      email,
      password,
    }),
  });

  if (response.ok) {
    let data = await response.json();
    setSession(data.token);
  } else {
    try {
      throw new Error(await response.json());
    } catch (e) {
      throw new Error(response.statusText);
    }
  }
}

export async function logout() {
  if (session()) {
    call("/api/logout", POST, authenticated(), { cache: "no-store" });
  }

  clearSession();
}

export async function state() {
  if (session()) {
    try {
      return await call("/api/state", authenticated());
    } catch (e) {
      console.error(e);
    }
  }

  return undefined;
}
