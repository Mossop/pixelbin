import { DateTime, LocalZone } from "luxon";

export type { DateTime };

export function now(): DateTime {
  return DateTime.utc();
}

export function hasTimezone(dt: DateTime): boolean {
  return !(dt.zone instanceof LocalZone);
}

export function formatDateTime(dt: DateTime): string {
  return dt.toLocaleString(DateTime.DATETIME_SHORT);
}

const pad2 = (val: number): string => val < 10 ? `0${val}` : val.toString();
const pad3 = (val: number): string => val < 100 ? `0${pad2(val)}` : val.toString();

export function isoDateTime(dt: DateTime): string {
  let date = `${dt.year}-${pad2(dt.month)}-${pad2(dt.day)}`;
  let time = `${pad2(dt.hour)}:${pad2(dt.minute)}:${pad2(dt.second)}.${pad3(dt.millisecond)}`;

  if (hasTimezone(dt)) {
    let offset = dt.offset;
    if (offset == 0) {
      time += "Z";
    } else {
      let abs = Math.abs(offset);
      let hours = pad2(abs / 60);
      let minutes = pad2(abs % 60);
      time += offset < 0 ? `-${hours}:${minutes}` : `+${hours}:${minutes}`;
    }
  }

  return `${date}T${time}`;
}

export function parseDateTime(val: string): DateTime {
  let dt = DateTime.fromISO(val, {
    setZone: true,
  });

  if (dt.invalidExplanation) {
    throw new Error(dt.invalidExplanation);
  }

  return dt;
}

export function isDateTime(val: unknown): val is DateTime {
  return DateTime.isDateTime(val);
}

export function dateTimeFromMillis(millis: number): DateTime {
  return DateTime.fromMillis(millis);
}
