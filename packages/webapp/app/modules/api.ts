import { Session } from "./session";
import { ApiRequest, apiFetch } from "./telemetry";
import {
  Album,
  ApiMediaRelations,
  ApiMediaView,
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

async function rawApiCall<T>(
  path: string,
  label: string,
  ...options: ApiRequest[]
): Promise<T> {
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
    return response.json();
  }
  try {
    throw new Error(await response.json());
  } catch (e) {
    throw new Error(response.statusText);
  }
}

async function apiCall<T>(
  session: Session,
  path: string,
  label: string,
  ...options: ApiRequest[]
): Promise<T> {
  try {
    return await rawApiCall(path, label, authenticated(session), ...options);
  } catch (e) {
    if (e instanceof Response) {
      if ([404, 401, 403].includes(e.status)) {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw new Response(null, {
          status: 404,
          statusText: "Not Found",
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw e;
    }

    throw e;
  }
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
  return rawApiCall<ApiConfig>("/api/config", "config");
}

export async function login(session: Session, email: string, password: string) {
  const response = await rawApiCall<LoginResponse>(
    "/api/login",
    "login",
    POST,
    json({
      email,
      password,
    }),
    { cache: "no-store" },
  );

  if (response.token) {
    session.set("token", response.token);
  }
}

export async function logout(session: Session) {
  if (session.get("token")) {
    apiCall(session, "/api/logout", "logout", POST, { cache: "no-store" });
  }
}

export async function state(session: Session): Promise<State | undefined> {
  if (session.get("token")) {
    try {
      return await rawApiCall<State>(
        "/api/state",
        "state",
        authenticated(session),
      );
    } catch (e) {
      console.error(e);
    }
  }

  return undefined;
}

export async function getAlbum(session: Session, id: string): Promise<Album> {
  assertAuthenticated(session);

  return apiCall<Album>(session, `/api/album/${id}`, "getAlbum");
}

export async function getSearch(
  session: Session,
  id: string,
): Promise<SavedSearch> {
  return apiCall<SavedSearch>(session, `/api/search/${id}`, "getSearch");
}

export async function getCatalog(
  session: Session,
  id: string,
): Promise<Catalog> {
  assertAuthenticated(session);

  return apiCall<Catalog>(session, `/api/catalog/${id}`, "getCatalog");
}

interface ListMediaResponse<T> {
  total: number;
  media: T[];
}

const LIST_COUNT = 500;

export async function* listMedia(
  session: Session,
  source: "album" | "catalog" | "search",
  id: string,
): AsyncGenerator<ApiMediaView[], void, unknown> {
  if (source != "search") {
    assertAuthenticated(session);
  }

  let response = await apiCall<ListMediaResponse<ApiMediaView>>(
    session,
    `/api/${source}/${id}/media?count=${LIST_COUNT}`,
    "listMedia",
  );

  yield response.media;

  let remainingChunks = [];
  let offset = response.media.length;
  while (offset <= response.total) {
    remainingChunks.push(
      apiCall<ListMediaResponse<ApiMediaView>>(
        session,
        `/api/${source}/${id}/media?offset=${offset}&count=${LIST_COUNT}`,
        "listMedia",
      ),
    );

    offset += LIST_COUNT;
  }

  for (let chunkPromise of remainingChunks) {
    yield (await chunkPromise).media;
  }
}

export async function* searchMedia(
  session: Session,
  catalog: string,
  query: SearchQuery,
): AsyncGenerator<ApiMediaView[], void, unknown> {
  assertAuthenticated(session);

  let response = await apiCall<ListMediaResponse<ApiMediaView>>(
    session,
    `/api/search`,
    "searchMedia",
    POST,
    json({
      catalog,
      count: LIST_COUNT,
      query,
    }),
  );

  yield response.media;

  let remainingChunks = [];
  let offset = response.media.length;
  while (offset <= response.total) {
    remainingChunks.push(
      apiCall<ListMediaResponse<ApiMediaView>>(
        session,
        `/api/search`,
        "searchMedia",
        POST,
        json({
          catalog,
          offset,
          count: LIST_COUNT,
          query,
        }),
      ),
    );

    offset += LIST_COUNT;
  }

  for (let chunkPromise of remainingChunks) {
    yield (await chunkPromise).media;
  }
}

export async function getMedia(
  session: Session,
  id: string,
): Promise<ApiMediaRelations> {
  let response = await apiCall<ListMediaResponse<ApiMediaRelations>>(
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
  await apiCall<ApiResponse>(
    session,
    `/api/media/edit`,
    "getMedia",
    POST,
    json({ id, public: true }),
  );
}
