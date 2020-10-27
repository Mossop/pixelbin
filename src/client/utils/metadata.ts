import type { MediaState } from "../api/types";

export function mediaTitle(media: MediaState): string | null {
  return media.title ?? media.filename;
}