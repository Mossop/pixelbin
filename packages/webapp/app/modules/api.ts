import {
  context as telemetryContext,
  propagation,
  Span,
  SpanKind,
  SpanStatusCode,
} from "@opentelemetry/api";
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_PATH,
} from "@opentelemetry/semantic-conventions";

import { RequestContext } from "./RequestContext";
import { inSpan } from "modules/telemetry.mjs";
import {
  Album,
  ApiMediaRelations,
  ApiResponse,
  Catalog,
  LoginResponse,
  Replace,
  SavedSearch,
  SearchQuery,
  State,
} from "./types";

export const GET = (): ApiRequest => ({ method: "GET", headers: {} });
export const POST = (): ApiRequest => ({ method: "POST", headers: {} });

async function toJson<T>(response: Response): Promise<T> {
  let result = await response.json();
  return result as unknown as T;
}

function apiUrl(): string {
  let url = process.env.PIXELBIN_API_URL;
  if (url?.endsWith("/")) {
    return url.substring(0, url.length - 1);
  }

  return url ?? "";
}

function assertAuthenticated(context: RequestContext) {
  if (!context.isAuthenticated()) {
    throw new Error("Not yet authenticated");
  }
}

function authenticated(context: RequestContext): RequestBuilder {
  return (init: ApiRequest) => ({
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${context.get("token")}`,
    },
  });
}

function json(data: object): RequestBuilder {
  return (init: ApiRequest) => ({
    ...init,
    headers: {
      ...init.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export class ResponseError extends Error {
  public readonly response: Response;

  public readonly isNotFound: boolean;

  constructor(response: Response) {
    super(`${response.status} ${response.statusText}`);

    this.isNotFound = [404, 401, 403].includes(response.status);
    if (this.isNotFound) {
      this.response = new Response(null, {
        status: 404,
        statusText: "Not Found",
      });
    } else {
      this.response = response;
    }
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ResponseError && error.isNotFound;
}

export type ApiRequest = Replace<
  RequestInit,
  {
    headers: Record<string, string>;
  }
>;
export type RequestBuilder = (request: ApiRequest) => ApiRequest;

export function forwardedRequest(
  requestContext: RequestContext,
): RequestBuilder {
  return (init) => ({
    ...init,
    headers: {
      ...init.headers,
      Forwarded: `for="${requestContext.expressRequest.ip}"`,
    },
  });
}

export function apiResponse(
  path: string,
  label: string,
  ...builders: RequestBuilder[]
): Promise<Response> {
  let init = GET();

  for (let builder of builders) {
    init = builder(init);
  }

  let method = init.method ?? "GET";

  return inSpan(
    {
      name: `API call: ${method} ${label}`,
      kind: SpanKind.CLIENT,
      attributes: {
        [ATTR_HTTP_REQUEST_METHOD]: method,
        [ATTR_URL_PATH]: path,
      },
    },
    async (span: Span) => {
      propagation.inject(telemetryContext.active(), init.headers, {
        set(headers: Record<string, string>, key: string, value: string) {
          headers[key] = value;
        },
      });

      let response = await fetch(`${apiUrl()}${path}`, init);

      span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, response.status);

      if (response.status < 200 || response.status >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `${response.status} ${response.statusText}`,
        });
      }

      return response;
    },
  );
}

export async function apiCall(
  path: string,
  label: string,
  ...builders: RequestBuilder[]
): Promise<Response> {
  let response = await apiResponse(path, label, ...builders);

  if (response.ok) {
    return response;
  }

  throw new ResponseError(response);
}

async function jsonApiCall<T>(
  context: RequestContext,
  path: string,
  label: string,
  ...builders: RequestBuilder[]
): Promise<T> {
  let response = await apiCall(
    path,
    label,
    forwardedRequest(context),
    authenticated(context),
    ...builders,
  );

  return toJson(response);
}

export interface ThumbnailConfig {
  alternateTypes: string[];
  sizes: number[];
}

export interface ApiConfig {
  serviceChangeset?: string;
  webappChangeset?: string;
  apiUrl: string;
  thumbnails: ThumbnailConfig;
}

export async function config(context: RequestContext): Promise<ApiConfig> {
  let response = await apiCall(
    "/api/config",
    "config",
    forwardedRequest(context),
  );
  return toJson(response);
}

export async function login(
  context: RequestContext,
  email: string,
  password: string,
) {
  let response = await apiCall(
    "/api/login",
    "login",
    POST,
    json({
      email,
      password,
    }),
    forwardedRequest(context),
    (init) => ({ ...init, cache: "no-store" }),
  );

  let result: LoginResponse = await response.json();

  if (result.token) {
    context.set("token", result.token);
  }
}

export async function verifySubscription(
  context: RequestContext,
  token: string,
) {
  await apiCall(
    "/api/verify",
    "subscribe",
    POST,
    json({
      token,
    }),
    forwardedRequest(context),
    (init) => ({ ...init, cache: "no-store" }),
  );
}

export async function cancelSubscription(
  context: RequestContext,
  email: string,
  search: string | null,
) {
  await apiCall(
    "/api/unsubscribe",
    "subscribe",
    POST,
    json({
      email,
      search,
    }),
    forwardedRequest(context),
    (init) => ({ ...init, cache: "no-store" }),
  );
}

export async function logout(context: RequestContext) {
  if (context.get("token")) {
    return jsonApiCall(context, "/api/logout", "logout", POST, (init) => ({
      ...init,
      cache: "no-store",
    }));
  }
}

export async function state(
  context: RequestContext,
): Promise<State | undefined> {
  if (context.get("token")) {
    try {
      let response = await apiCall(
        "/api/state",
        "state",
        forwardedRequest(context),
        authenticated(context),
      );

      return await toJson(response);
    } catch (e) {
      console.error(e);
    }
  }

  return undefined;
}

export async function getAlbum(
  context: RequestContext,
  id: string,
): Promise<Album> {
  assertAuthenticated(context);

  return jsonApiCall<Album>(context, `/api/album/${id}`, "getAlbum");
}

export async function getSearch(
  context: RequestContext,
  id: string,
): Promise<SavedSearch> {
  return jsonApiCall<SavedSearch>(context, `/api/search/${id}`, "getSearch");
}

export async function getCatalog(
  context: RequestContext,
  id: string,
): Promise<Catalog> {
  assertAuthenticated(context);

  return jsonApiCall<Catalog>(context, `/api/catalog/${id}`, "getCatalog");
}

interface ListMediaResponse<T> {
  total: number;
  media: T[];
}

export type MediaSource = "album" | "catalog" | "search";
export function isMediaSource(
  container: string | undefined,
): container is MediaSource {
  if (!container) {
    return false;
  }
  return ["catalog", "album", "search"].includes(container);
}

export function listMedia(
  context: RequestContext,
  source: MediaSource,
  id: string,
): Promise<Response> {
  if (source != "search") {
    assertAuthenticated(context);
  }

  let url = new URL(context.request.url);

  let path = `/api/${source}/${id}/media`;
  let params = new URLSearchParams();

  if (url.searchParams.has("since")) {
    params.set("since", url.searchParams.get("since")!);
  }

  if (params.size) {
    path += `?${params}`;
  }

  console.log(path);

  return apiCall(
    path,
    "listMedia",
    forwardedRequest(context),
    authenticated(context),
  );
}

export function searchMedia(
  context: RequestContext,
  catalog: string,
  query: SearchQuery,
): Promise<Response> {
  assertAuthenticated(context);

  return apiCall(
    `/api/search`,
    "searchMedia",
    forwardedRequest(context),
    authenticated(context),
    POST,
    json({
      catalog,
      query,
    }),
  );
}

export async function getMedia(
  context: RequestContext,
  id: string,
  search: string | null,
): Promise<ApiMediaRelations> {
  let path = `/api/media/${id}${search ? `?search=${search}` : ""}`;
  let response = await jsonApiCall<ListMediaResponse<ApiMediaRelations>>(
    context,
    path,
    "getMedia",
  );

  if (response.media.length) {
    return response.media[0];
  }

  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw new Response(null, {
    status: 404,
    statusText: "Not Found",
  });
}

export async function markMediaPublic(
  context: RequestContext,
  id: string,
): Promise<void> {
  await jsonApiCall<ApiResponse>(
    context,
    `/api/media/edit`,
    "getMedia",
    POST,
    json({ id, public: true }),
  );
}
