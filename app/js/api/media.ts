import { Search } from "../utils/search";
import { intoId, MapId } from "../utils/maps";
import { request } from "./api";
import { ApiMethod, UnprocessedMediaData, MediaCreateData } from "./types";

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

export function uploadMedia(media: MapId<MediaData>, file: File): Promise<MediaData> {
  return request(ApiMethod.MediaUpload, {
    id: intoId(media),
    file,
  });
}

export function searchMedia(search: Search): Promise<MediaData[]> {
  return request(ApiMethod.MediaSearch, search);
}

export async function thumbnail(media: MapId<MediaData>, size: number): Promise<ImageBitmap> {
  return createImageBitmap(await request(ApiMethod.MediaThumbnail, {
    id: intoId(media),
    size,
  }));
}
