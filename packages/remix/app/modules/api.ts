"use server";

import { Session } from "./session";
import { ApiRequest, apiFetch } from "./telemetry";
import {
  Album,
  ApiMediaRelations,
  ApiMediaView,
  Catalog,
  LoginResponse,
  MediaRelations,
  SavedSearch,
  State,
} from "./types";
import { deserializeMediaView } from "./util";

const GET: ApiRequest = { method: "GET" };
const POST: ApiRequest = { method: "POST" };

const DEEP_OPTIONS = ["headers", "next"];

function isNotFoundError(e: unknown): boolean {
  if (!(e instanceof Error)) {
    return false;
  }

  switch (e.message) {
    case "Not yet authenticated":
    case "Unauthorized":
    case "Not Found":
      return true;
    default:
      return false;
  }
}

function authenticated(session: Session): ApiRequest {
  if (!session.get("token")) {
    throw new Error("Not yet authenticated");
  }

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

  const response = await apiFetch(path, init);

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
  ...options: ApiRequest[]
): Promise<T> {
  try {
    return await rawApiCall(path, authenticated(session), ...options);
  } catch (e) {
    if (isNotFoundError(e)) {
      // TODO
    }

    throw e;
  }
}

export interface ThumbnailConfig {
  alternateTypes: string[];
  sizes: number[];
}

export interface ApiConfig {
  apiUrl: string;
  thumbnails: ThumbnailConfig;
}

export async function config(): Promise<ApiConfig> {
  return rawApiCall<ApiConfig>("/api/config");
}

export async function login(session: Session, email: string, password: string) {
  const response = await rawApiCall<LoginResponse>(
    "/api/login",
    POST,
    json({
      email,
      password,
    }),
    { cache: "no-store" }
  );

  if (response.token) {
    session.set("token", response.token);
  }
}

export async function logout(session: Session) {
  if (session.get("token")) {
    apiCall(session, "/api/logout", POST, { cache: "no-store" });
  }
}

export async function state(session: Session): Promise<State | undefined> {
  if (session.get("token")) {
    try {
      return await rawApiCall<State>("/api/state", authenticated(session));
    } catch (e) {
      console.error(e);
    }
  }

  return undefined;
}

export async function getAlbum(session: Session, id: string): Promise<Album> {
  return apiCall<Album>(session, `/api/album/${id}`);
}

export async function getSearch(
  session: Session,
  id: string
): Promise<SavedSearch> {
  return apiCall<SavedSearch>(session, `/api/search/${id}`);
}

export async function getCatalog(
  session: Session,
  id: string
): Promise<Catalog> {
  return apiCall<Catalog>(session, `/api/catalog/${id}`);
}

interface ListMediaResponse<T> {
  total: number;
  media: T[];
}

const LIST_COUNT = 500;

export async function* listMedia(
  session: Session,
  source: "album" | "catalog" | "search",
  id: string
): AsyncGenerator<ApiMediaView[], void, unknown> {
  let offset = 0;
  while (true) {
    const response = await apiCall<ListMediaResponse<ApiMediaView>>(
      session,
      `/api/${source}/${id}/media?offset=${offset}&count=${LIST_COUNT}`
    );
    yield response.media;
    offset += LIST_COUNT;

    if (offset >= response.total) {
      break;
    }
  }
}

export async function getMedia(
  session: Session,
  id: string
): Promise<MediaRelations> {
  const response = await apiCall<ListMediaResponse<ApiMediaRelations>>(
    session,
    `/api/media/${id}`
  );

  if (response.media.length) {
    return deserializeMediaView(response.media[0]);
  }

  throw new Error("Not found");
}
