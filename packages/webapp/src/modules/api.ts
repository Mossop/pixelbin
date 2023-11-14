"use server";

import { notFound } from "next/navigation";

import { clearSession, session, setSession } from "./session";
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

const GET: RequestInit = { method: "GET" };
const POST: RequestInit = { method: "POST" };

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
  }
  try {
    throw new Error(await response.json());
  } catch (e) {
    throw new Error(response.statusText);
  }
}

async function apiCall<T>(path: string, ...options: RequestInit[]): Promise<T> {
  try {
    return await rawApiCall(path, authenticated(), ...options);
  } catch (e) {
    if (isNotFoundError(e)) {
      notFound();
    }

    throw e;
  }
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
      return await rawApiCall<State>("/api/state", authenticated());
    } catch (e) {
      console.error(e);
    }
  }

  return undefined;
}

export async function getAlbum(id: string): Promise<Album> {
  return apiCall<Album>(`/api/album/${id}`);
}

export async function getSearch(id: string): Promise<SavedSearch> {
  return apiCall<SavedSearch>(`/api/search/${id}`);
}

export async function getCatalog(id: string): Promise<Catalog> {
  return apiCall<Catalog>(`/api/catalog/${id}`);
}

interface ListMediaResponse<T> {
  total: number;
  media: T[];
}

const LIST_COUNT = 500;

export async function* listMedia(
  source: "album" | "catalog" | "search",
  id: string,
): AsyncGenerator<ApiMediaView[], void, unknown> {
  let offset = 0;
  while (true) {
    let response = await apiCall<ListMediaResponse<ApiMediaView>>(
      `/api/${source}/${id}/media?offset=${offset}&count=${LIST_COUNT}`,
    );
    yield response.media;
    offset += LIST_COUNT;

    if (offset >= response.total) {
      break;
    }
  }
}

export async function getMedia(id: string): Promise<MediaRelations> {
  let response = await apiCall<ListMediaResponse<ApiMediaRelations>>(
    `/api/media/${id}`,
  );

  if (response.media.length) {
    return deserializeMediaView(response.media[0]);
  }

  throw new Error("Not found");
}
