import type { Draft } from "immer";

import type { Api } from "../../model";
import { Method } from "../../model";
import { request } from "./api";
import type { Album, Catalog } from "./highlevel";
import type { MediaState, ProcessedMediaState } from "./types";
import { mediaIntoState } from "./types";

export type MediaTarget = Catalog | Album;

export async function getMedia(ids: string[]): Promise<(Draft<MediaState> | null)[]> {
  let media = await request(Method.MediaGet, {
    id: ids.join(","),
  });
  return media.map((media: Api.Media | null): Draft<MediaState> | null => {
    if (media) {
      return mediaIntoState(media);
    }
    return null;
  });
}

export function getThumbnailUrl(media: ProcessedMediaState, size: number): string {
  return `${media.file.thumbnailUrl}/${size}`;
}
