import {
  createCookieSessionStorage,
  Session as RemixSession,
} from "@remix-run/node"; // or cloudflare/deno

type SessionData = {
  token: string | null;
};

export type Session = RemixSession<SessionData>;

const COOKIE_NAME = "px_session";

const {
  getSession: sessionGetter,
  commitSession,
  destroySession,
} = createCookieSessionStorage<SessionData>({
  cookie: {
    name: COOKIE_NAME,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: ["48rfg2874gf87234h08h8hf82h48072hg82"],
    secure: true,
  },
});

export function getSession(request: Request): Promise<Session> {
  return sessionGetter(request.headers.get("Cookie"));
}

export { commitSession, destroySession };
