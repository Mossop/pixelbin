import Knex, { Raw, Ref } from "knex";
import { isMoment } from "moment-timezone";

import { Table } from ".";
import { AllNull, Obj } from "../../../utils";

export type QueryBuilder<T, R = T[]> = Knex.QueryBuilder<T, R>;

export type AllOrNulls<T> = T | AllNull<T>;

export type WithRefs<Record> = {
  [K in keyof Record]: Raw | Ref<string, Obj> | Record[K];
};

export function intoDBType(value: unknown): Knex.Value {
  if (isMoment(value)) {
    return value.utc().toISOString();
  }
  return value as Knex.Value;
}

export function intoDBTypes<T>(data: T): T {
  // @ts-ignore: Bad TypeScript.
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
