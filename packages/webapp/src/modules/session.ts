import { cookies } from "next/headers";

const COOKIE_NAME = "px_session";

export function session(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value;
}

export function setSession(email: string) {
  cookies().set({ name: COOKIE_NAME, value: email, httpOnly: true });
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}
