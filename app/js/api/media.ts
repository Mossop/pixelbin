import type { Search } from "../utils/search";
import type { Patch } from "./helpers";
import { Catalog, Album } from "./highlevel";
import type { Reference, Media } from "./highlevel";
import request from "./request";
import { ApiMethod, MediaInfoData } from "./types";
import type { MediaData, MediaCreateData } from "./types";

export type MediaTarget = Catalog | Album;

export type ProcessedMediaData = Omit<MediaData, "info"> & {
  readonly info: MediaInfoData;
};

export type UnprocessedMediaData = Omit<MediaData, "info"> & {
  readonly info: null;
};

export function isProcessed(media: MediaData): media is ProcessedMediaData {
  return media.info !== null;
}

export function isUnprocessed(media: MediaData): media is UnprocessedMediaData {
  return media.info === null;
}

export function getMedia(id: string): Promise<MediaData> {
  return request(ApiMethod.MediaGet, { id });
}

export function createMedia(media: MediaCreateData): Promise<MediaData> {
  return request(ApiMethod.MediaCreate, media);
}

export function updateMedia(media: Patch<MediaCreateData, Media>): Promise<MediaData> {
  return request(ApiMethod.MediaUpdate, media);
}

export function searchMedia(search: Search): Promise<readonly MediaData[]> {
  return request(ApiMethod.MediaSearch, search);
}

export async function thumbnail(media: Reference<Media>, size: number): Promise<ImageBitmap> {
  return createImageBitmap(await request(ApiMethod.MediaThumbnail, {
    media,
    size,
  }));
}
