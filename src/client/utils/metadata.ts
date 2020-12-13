import type { DateTime } from "../../utils/datetime";
import type { BaseMediaState } from "../api/types";

export function mediaTitle(media: BaseMediaState): string | null {
  return media.title ?? media.filename;
}

export function mediaDate(media: BaseMediaState): DateTime {
  return media.taken ?? media.file?.uploaded ?? media.created;
}
