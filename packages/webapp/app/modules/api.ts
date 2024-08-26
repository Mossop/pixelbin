import { Session } from "./session";
import { ApiRequest, apiFetch } from "./telemetry";
import {
  Album,
  ApiMediaRelations,
  ApiResponse,
  Catalog,
  LoginResponse,
  SavedSearch,
  SearchQuery,
  State,
} from "./types";

const GET: ApiRequest = { method: "GET" };
const POST: ApiRequest = { method: "POST" };

const DEEP_OPTIONS = ["headers", "next"];

function assertAuthenticated(session: Session) {
  if (!session.get("token")) {
    throw new Error("Not yet authenticated");
  }
}

function authenticated(session: Session): ApiRequest {
  return {
    headers: {
      Authorization: `Bearer ${session.get("token")}`,
    },
  };
}

function json(data: object): ApiRequest {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

export class ResponseError extends Error {
  public readonly response: Response;

  constructor(response: Response) {
    super(`${response.status} ${response.statusText}`);

    if ([404, 401, 403].includes(response.status)) {
      this.response = new Response(null, {
        status: 404,
        statusText: "Not Found",
      });
    } else {
      this.response = response;
    }
  }
}

async function rawApiCall(
  path: string,
  label: string,
  ...options: ApiRequest[]
): Promise<Response> {
  const init = { ...GET };

  for (const option of options) {
    for (const [key, value] of Object.entries(option)) {
      if (key in init && DEEP_OPTIONS.includes(key)) {
        // @ts-expect-error Foo
        Object.assign(init[key], value);
      } else {
        // @ts-expect-error Foo
        init[key] = value;
      }
    }
  }

  const response = await apiFetch(path, label, init);

  if (response.ok) {
    return response;
  }

  throw new ResponseError(response);
}

async function authenticatedApiCall(
  session: Session,
  path: string,
  label: string,
  ...options: ApiRequest[]
) {
  return rawApiCall(path, label, authenticated(session), ...options);
}

async function jsonApiCall<T>(
  session: Session,
  path: string,
  label: string,
  ...options: ApiRequest[]
): Promise<T> {
  let response = await authenticatedApiCall(session, path, label, ...options);
  return response.json();
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

export async function config(): Promise<ApiConfig> {
  let response = await rawApiCall("/api/config", "config");
  return response.json();
}

export async function login(session: Session, email: string, password: string) {
  let response = await rawApiCall(
    "/api/login",
    "login",
    POST,
    json({
      email,
      password,
    }),
    { cache: "no-store" },
  );

  let result: LoginResponse = await response.json();

  if (result.token) {
    session.set("token", result.token);
  }
}

export async function logout(session: Session) {
  if (session.get("token")) {
    jsonApiCall(session, "/api/logout", "logout", POST, { cache: "no-store" });
  }
}

export async function state(session: Session): Promise<State | undefined> {
  if (session.get("token")) {
    try {
      let response = await rawApiCall(
        "/api/state",
        "state",
        authenticated(session),
      );

      return await response.json();
    } catch (e) {
      console.error(e);
    }
  }

  return undefined;
}

export async function getAlbum(session: Session, id: string): Promise<Album> {
  assertAuthenticated(session);

  return jsonApiCall<Album>(session, `/api/album/${id}`, "getAlbum");
}

export async function getSearch(
  session: Session,
  id: string,
): Promise<SavedSearch> {
  return jsonApiCall<SavedSearch>(session, `/api/search/${id}`, "getSearch");
}

export async function getCatalog(
  session: Session,
  id: string,
): Promise<Catalog> {
  assertAuthenticated(session);

  return jsonApiCall<Catalog>(session, `/api/catalog/${id}`, "getCatalog");
}

interface ListMediaResponse<T> {
  total: number;
  media: T[];
}

export function listMedia(
  session: Session,
  source: "album" | "catalog" | "search",
  id: string,
): Promise<Response> {
  if (source != "search") {
    assertAuthenticated(session);
  }

  return authenticatedApiCall(
    session,
    `/api/${source}/${id}/media`,
    "listMedia",
  );
}

export function searchMedia(
  session: Session,
  catalog: string,
  query: SearchQuery,
): Promise<Response> {
  assertAuthenticated(session);

  return authenticatedApiCall(
    session,
    `/api/search`,
    "searchMedia",
    POST,
    json({
      catalog,
      query,
    }),
  );
}

export async function getMedia(
  session: Session,
  id: string,
): Promise<ApiMediaRelations> {
  let response = await jsonApiCall<ListMediaResponse<ApiMediaRelations>>(
    session,
    `/api/media/${id}`,
    "getMedia",
  );

  if (response.media.length) {
    return response.media[0];
  }

  // eslint-disable-next-line @typescript-eslint/no-throw-literal
  throw new Response(null, {
    status: 404,
    statusText: "Not Found",
  });
}

export async function markMediaPublic(
  session: Session,
  id: String,
): Promise<void> {
  await jsonApiCall<ApiResponse>(
    session,
    `/api/media/edit`,
    "getMedia",
    POST,
    json({ id, public: true }),
  );
}
