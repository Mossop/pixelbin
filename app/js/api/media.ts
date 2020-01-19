import { Search } from "../utils/search";
import { request } from "./api";
import { Patch } from "./helpers";
import { Catalog, Album, Reference, Media } from "./highlevel";
import { ApiMethod, UnprocessedMediaData, MediaCreateData } from "./types";

export type MediaTarget = Catalog | Album;

type ProcessParams = "processVersion" | "uploaded" | "mimetype" | "width" | "height" | "duration" | "fileSize";
export type ProcessedMediaData = {
  [K in keyof UnprocessedMediaData]: K extends ProcessParams ? NonNullable<UnprocessedMediaData[K]> : UnprocessedMediaData[K];
};
export type MediaData = ProcessedMediaData | UnprocessedMediaData;

export function isProcessed(media: MediaData): media is ProcessedMediaData {
  return media.processVersion !== null;
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
