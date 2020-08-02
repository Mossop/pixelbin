import Knex, { Raw, Ref } from "knex";
import moment, { Moment, isMoment } from "moment-timezone";

import { Table } from ".";
import { Dereference, ListsIn } from "../../../model";
import { Obj } from "../../../utils";

export type QueryBuilder<T, R = T[]> = Knex.QueryBuilder<T, R>;

type AllNull<T> = {
  [K in keyof T]: null;
};

export type AllOrNulls<T> = T | AllNull<T>;

type DBType<J> = J extends Moment
  ? string
  : undefined extends J
    ? never
    : J;

type DBTyped<T> = {
  [K in keyof T]: DBType<T[K]>;
};

// Translates a model into the API view.
export type DBAPI<Table> = {
  [Column in keyof Omit<Table, ListsIn<Table>>]: Dereference<Table[Column]>;
};

// Translates a model into the DB fields
export type DBRecord<Table> = DBTyped<DBAPI<Table>>;

export type WithRefs<Record> = {
  [K in keyof Record]: Raw | Ref<string, Obj> | Record[K];
};

function intoDBType(_key: string, value: unknown): unknown {
  if (isMoment(value)) {
    return value.utc().toISOString();
  }
  return value;
}

export function intoDBTypes<T>(data: DBAPI<T>): DBRecord<T> {
  // @ts-ignore: Bad TypeScript.
  return Object.fromEntries(
    Object.entries(data)
      .filter(([_key, value]: [string, unknown]): boolean => value !== undefined)
      .map(([key, value]: [string, unknown]): [string, unknown] => {
        return [key, intoDBType(key, value)];
      }),
  );
}

function intoAPIType(key: string, value: unknown): unknown {
  if (value instanceof Date) {
    console.log("Got from DB:", value);
    return moment(value).utc();
  }

  return value;
}

export function intoAPITypes<T>(data: DBRecord<T>): DBAPI<T> {
  // @ts-ignore: Bad TypeScript.
  return Object.fromEntries(
    Object.entries(data)
      .filter(([_key, value]: [string, unknown]): boolean => value !== undefined)
      .map(([key, value]: [string, unknown]): [string, unknown] => {
        return [key, intoAPIType(key, value)];
      }),
  );
}

export function columnFor(table: Table): string {
  return table.charAt(0).toLocaleLowerCase() + table.substr(1);
}
