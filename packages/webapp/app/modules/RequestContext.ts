import {
  AppLoadContext,
  createCookieSessionStorage,
  Session as RouterSession,
} from "react-router";
import { Request as ExpressRequest } from "express";

interface SessionData {
  token: string | null;
}

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

export class RequestContext {
  private static CONTEXTS = new WeakMap<Request, RequestContext>();

  private constructor(
    public readonly request: Request,
    private readonly appContext: AppLoadContext,
    private readonly inner: RouterSession<SessionData>,
  ) {}

  public get expressRequest(): ExpressRequest {
    return this.appContext.expressRequest;
  }

  public has(key: keyof SessionData): boolean {
    return this.inner.has(key);
  }

  public get<K extends keyof SessionData>(key: K): SessionData[K] | undefined {
    return this.inner.get(key);
  }

  public set<K extends keyof SessionData>(key: K, value: SessionData[K]) {
    return this.inner.set(key, value);
  }

  public isAuthenticated(): boolean {
    return this.has("token");
  }

  public commit(): Promise<string> {
    return commitSession(this.inner);
  }

  public destroy(): Promise<string> {
    return destroySession(this.inner);
  }

  public static async get(
    request: Request,
    appContext: AppLoadContext,
  ): Promise<RequestContext> {
    let context = RequestContext.CONTEXTS.get(request);
    if (context) {
      return context;
    }

    let inner = await sessionGetter(request.headers.get("Cookie"));
    context = new RequestContext(request, appContext, inner);
    RequestContext.CONTEXTS.set(request, context);

    return context;
  }
}

export async function getRequestContext(
  request: Request,
  context: AppLoadContext,
): Promise<RequestContext> {
  return RequestContext.get(request, context);
}
