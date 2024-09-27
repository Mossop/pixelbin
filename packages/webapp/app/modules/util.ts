import { DateTime, Duration, FixedOffsetZone } from "luxon";
import { SetStateAction } from "react";

import {
  ApiMediaRelations,
  ApiMediaView,
  ApiMediaViewFile,
  MediaRelations,
  MediaView,
  MediaViewFile,
} from "./types";

function isActionSetter<T>(ssa: SetStateAction<T>): ssa is (prev: T) => T {
  return typeof ssa == "function";
}

export function applySSA<T>(previous: T, ssa: SetStateAction<T>): T {
  return isActionSetter(ssa) ? ssa(previous) : ssa;
}

export function url(parts: string[], params?: URLSearchParams): string {
  let pstr = params ? `?${params}` : "";
  return `/${parts.map((p) => encodeURIComponent(p)).join("/")}${pstr}`;
}

export function mediaTitle(media: MediaView): string | null {
  return media.title ?? media.filename;
}

export function mediaDate(media: MediaView): DateTime {
  return media.taken ?? media.file?.uploaded ?? media.created;
}

export function deserializeMediaView(media: ApiMediaRelations): MediaRelations;
export function deserializeMediaView(media: ApiMediaView): MediaView;
export function deserializeMediaView(media: ApiMediaView): MediaView {
  const zone = media.takenZone
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

export function serializeMediaView(media: MediaRelations): ApiMediaRelations;
export function serializeMediaView(media: MediaView): ApiMediaView;
export function serializeMediaView(media: MediaView): ApiMediaView {
  let mediaFile: ApiMediaViewFile | null = null;
  if (media.file) {
    mediaFile = {
      ...media.file,
      uploaded: media.file.uploaded.toISO()!,
    };
  }

  return {
    ...media,
    created: media.created.toISO()!,
    updated: media.updated.toISO()!,
    datetime: media.datetime.toISO()!,
    taken: media.taken?.toISO() ?? null,
    file: mediaFile,
  };
}

export function formatTime(seconds: number): string {
  if (Number.isNaN(seconds)) {
    return "-:--";
  }

  let duration = Duration.fromMillis(seconds * 1000);

  return duration.toFormat("m:ss");
}

const KEY_MAP = new WeakMap<object, string>();

let keyId = 0;
export function keyFor(obj: object): string {
  let key = KEY_MAP.get(obj);
  if (key) {
    return key;
  }

  key = `obj${keyId++}`;
  KEY_MAP.set(obj, key);
  return key;
}
