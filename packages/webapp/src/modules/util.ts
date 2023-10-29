import { DateTime } from "luxon";
import { MediaView } from "./types";

export function url(parts: string[]): string {
  return "/" + parts.map((p) => encodeURIComponent(p)).join("/");
}

export function mediaTitle(media: MediaView): string | null {
  return media.title ?? media.filename;
}

export function mediaDate(media: MediaView): DateTime {
  return media.taken ?? media.file?.uploaded ?? media.created;
}
