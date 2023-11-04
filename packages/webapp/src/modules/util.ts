import { DateTime, FixedOffsetZone } from "luxon";

import {
  ApiMediaView,
  ApiMediaViewFile,
  MediaView,
  MediaViewFile,
} from "./types";

export function url(parts: string[]): string {
  return `/${parts.map((p) => encodeURIComponent(p)).join("/")}`;
}

export function mediaTitle(media: MediaView): string | null {
  return media.title ?? media.filename;
}

export function mediaDate(media: MediaView): DateTime {
  return media.taken ?? media.file?.uploaded ?? media.created;
}

export function deserializeMediaView(media: ApiMediaView): MediaView {
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
    taken: media.taken?.toISO() || null,
    file: mediaFile,
  };
}
