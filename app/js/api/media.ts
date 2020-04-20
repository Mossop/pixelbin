import type { Search } from "../utils/search";
import { request } from "./api";
import type { Patch } from "./helpers";
import { Catalog, Album } from "./highlevel";
import type { Reference, Media } from "./highlevel";
import { ApiMethod } from "./types";
import type { MediaData, MediaCreateData } from "./types";

export type MediaTarget = Catalog | Album;

type ProcessParams =
  "processVersion" |
  "uploaded" |
  "mimetype" |
  "width" |
  "height" |
  "duration" |
  "fileSize";
type ProcessedParam<K extends keyof MediaData> =
  K extends ProcessParams ? NonNullable<MediaData[K]> : MediaData[K];
export type ProcessedMediaData = {
  [K in keyof MediaData]: ProcessedParam<K>;
};
type UnprocessedParam<K extends keyof MediaData> =
  K extends ProcessParams ? null : MediaData[K];
export type UnprocessedMediaData = {
  [K in keyof MediaData]: UnprocessedParam<K>;
};

export function isProcessed(media: MediaData): media is ProcessedMediaData {
  return media.processVersion !== null;
}

export function isUnprocessed(media: MediaData): media is UnprocessedMediaData {
  return media.processVersion === null;
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

export function searchMedia(search: Search): Promise<MediaData[]> {
  return request(ApiMethod.MediaSearch, search);
}

export async function thumbnail(media: Reference<Media>, size: number): Promise<ImageBitmap> {
  return createImageBitmap(await request(ApiMethod.MediaThumbnail, {
    media,
    size,
  }));
}
