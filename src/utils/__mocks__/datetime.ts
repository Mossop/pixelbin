import { DateTime } from "luxon";

export const now = jest.fn((): DateTime => DateTime.utc());

export const formatDateTime = jest.fn((dt: DateTime): string => {
  return dt.toLocaleString(DateTime.DATETIME_SHORT);
});

export const isoDateTime = jest.fn((dt: DateTime): string => dt.toISO());

export const parseDateTime = jest.fn((val: string): DateTime => DateTime.fromISO(val, {
  zone: "UTC",
  setZone: true,
}));

export const isDateTime = jest.fn((val: unknown): val is DateTime => DateTime.isDateTime(val));

export const dateTimeFromMillis = jest.fn(
  (millis: number): DateTime => DateTime.fromMillis(millis, {
    zone: "UTC",
  }),
);
