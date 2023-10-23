"use server";

import { clearSession, setSession } from "./session";

export async function login(email: string, password: string) {
  let response = await fetch("http://localhost:8283/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (response.ok) {
    setSession(email);
  } else {
    try {
      throw new Error(await response.json());
    } catch (e) {
      throw new Error(response.statusText);
    }
  }
}

export async function logout() {
  clearSession();
}
