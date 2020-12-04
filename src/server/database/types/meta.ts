import type { default as Knex, Raw, Ref } from "knex";

import { Table } from ".";
import type { ObjectModel } from "../../../model";
import type { AllNull, Obj } from "../../../utils";
import { isDateTime, isoDateTime, hasTimezone } from "../../../utils";

export type QueryBuilder<T, R = T[]> = Knex.QueryBuilder<T, R>;

export type AllOrNulls<T> = T | AllNull<T>;

export type WithRefs<Record> = {
  [K in keyof Record]: Raw | Ref<string, Obj> | Record[K];
};

export function buildTimeZoneFields<T extends Partial<ObjectModel.Metadata>>(data: T): T {
  if (data.taken && !data.takenZone && hasTimezone(data.taken)) {
    return {
      ...data,
      takenZone: data.taken.zone.name,
    };
  }

  return data;
}

export function applyTimeZoneFields<T extends ObjectModel.Metadata>(data: T): T {
  // This is coming straight out of the database so the taken date is in local time wherever the
  // photo was taken.
  if (data.taken && data.takenZone) {
    return {
      ...data,
      taken: data.taken.setZone(data.takenZone, {
        keepLocalTime: true,
      }),
    };
  }

  return data;
}

export function intoDBType(value: unknown): Knex.Value {
  if (isDateTime(value)) {
    return isoDateTime(value);
  }
  return value as Knex.Value;
}

export function intoDBTypes<T>(data: T): T {
  // @ts-ignore
  return Object.fromEntries(
    Object.entries(data)
      .filter(([_key, value]: [string, unknown]): boolean => value !== undefined)
      .map(([key, value]: [string, unknown]): [string, unknown] => {
        return [key, intoDBType(value)];
      }),
  );
}

export function columnFor(table: string): string {
  if (table == Table.MediaInfo) {
    return "media";
  }
  return table.charAt(0).toLocaleLowerCase() + table.substr(1);
}
