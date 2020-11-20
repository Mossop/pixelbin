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

export function isoDateTime(dt: DateTime): string {
  return dt.toISO({
    includeOffset: hasTimezone(dt),
  });
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
