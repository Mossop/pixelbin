import { DateTime } from "luxon";

export type { DateTime };

export function now(): DateTime {
  return DateTime.utc();
}

export function formatDateTime(dt: DateTime): string {
  return dt.toLocaleString(DateTime.DATETIME_SHORT);
}

export function isoDateTime(dt: DateTime): string {
  return dt.toISO();
}

export function parseDateTime(val: string): DateTime {
  return DateTime.fromISO(val, {
    zone: "UTC",
    setZone: true,
  });
}

export function isDateTime(val: unknown): val is DateTime {
  return DateTime.isDateTime(val);
}

export function dateTimeFromMillis(millis: number): DateTime {
  return DateTime.fromMillis(millis, {
    zone: "UTC",
  });
}
