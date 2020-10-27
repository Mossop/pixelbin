import type { default as Knex, Raw, Ref } from "knex";
import { FixedOffsetZone } from "luxon";

import type { Table } from ".";
import type { ObjectModel } from "../../../model";
import type { AllNull, Obj, Nullable } from "../../../utils";
import { isDateTime, isoDateTime } from "../../../utils";

export type QueryBuilder<T, R = T[]> = Knex.QueryBuilder<T, R>;

export type AllOrNulls<T> = T | AllNull<T>;

export type WithRefs<Record> = {
  [K in keyof Record]: Raw | Ref<string, Obj> | Record[K];
};

type TimeFields = Nullable<Pick<ObjectModel.Metadata, "taken" | "takenZone">>;
export function buildTimeZoneFields<T extends Partial<TimeFields>>(data: T): T {
  if (data.taken === null) {
    return {
      ...data,
      taken: null,
      takenZone: null,
    };
  } else if (isDateTime(data.taken)) {
    return {
      ...data,
      taken: data.taken.setZone("UTC", { keepLocalTime: true }),
      takenZone: data.takenZone ?? data.taken.toFormat("ZZ"),
    };
  } else {
    return data;
  }
}

export function applyTimeZoneFields<T extends TimeFields>(data: T): T {
  if (data.taken && data.takenZone) {
    let zone = FixedOffsetZone.parseSpecifier(`UTC${data.takenZone}`);
    if (zone.isValid) {
      return {
        ...data,
        taken: data.taken.setZone(zone, {
          keepLocalTime: true,
        }),
      };
    }
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

export function intoAPITypes<T>(data: T): T {
  return data;
}

export function columnFor(table: Table): string {
  return table.charAt(0).toLocaleLowerCase() + table.substr(1);
}
