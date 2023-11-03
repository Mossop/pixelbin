"use server";

import { DateTime, FixedOffsetZone } from "luxon";
import { notFound } from "next/navigation";

import { clearSession, session, setSession } from "./session";
import {
  Album,
  ApiMediaView,
  Catalog,
  LoginResponse,
  MediaView,
  MediaViewFile,
  Replace,
  SavedSearch,
  State,
} from "./types";

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

function fixDates(media: ApiMediaView): MediaView {
  let zone = media.takenZone
    ? FixedOffsetZone.parseSpecifier(media.takenZone)
    : FixedOffsetZone.utcInstance;

  let datetime = DateTime.fromISO(media.datetime);
  if (zone) {
    datetime = datetime.setZone(zone);
  }

  let taken = null;
  if (media.taken) {
    taken = DateTime.fromISO(media.taken).setZone(zone, {
      keepLocalTime: true,
    });
  }

  let mediaFile: MediaViewFile | null = null;
  if (media.file) {
    mediaFile = {
      ...media.file,
      uploaded: DateTime.fromISO(media.file.uploaded),
    };
  }

  return {
    ...media,
    created: DateTime.fromISO(media.created),
    updated: DateTime.fromISO(media.updated),
    datetime,
    taken,
    file: mediaFile,
  };
}

export async function listAlbum(
  id: string,
): Promise<Replace<Album, { media: MediaView[] }>> {
  let album = await apiCall<Album & { media: ApiMediaView[] }>(
    `/api/album/${id}`,
  );

  return {
    ...album,
    media: album.media.map(fixDates),
  };
}

export async function listSearch(
  id: string,
): Promise<Replace<SavedSearch, { media: MediaView[] }>> {
  let search = await apiCall<SavedSearch & { media: ApiMediaView[] }>(
    `/api/search/${id}`,
  );

  return {
    ...search,
    media: search.media.map(fixDates),
  };
}

export async function listCatalog(
  id: string,
): Promise<Replace<Catalog, { media: MediaView[] }>> {
  let catalog = await apiCall<Catalog & { media: ApiMediaView[] }>(
    `/api/catalog/${id}`,
  );

  return {
    ...catalog,
    media: catalog.media.map(fixDates),
  };
}
