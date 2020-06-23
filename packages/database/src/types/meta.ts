import { Raw, Ref } from "knex";
import { Moment, isMoment } from "moment";
import { Dereference, ListsIn } from "pixelbin-object-model";
import { Obj } from "pixelbin-utils";

type DBType<JSType> = JSType extends Moment ? string : JSType;

export type DbRecord<Table> = {
  [Column in keyof Omit<Table, ListsIn<Table>>]: Dereference<Table[Column]>;
};

export type DBTypes = Raw | Ref<string, Obj> | number | string | null;
export type JSTypes = DBTypes | Moment | undefined;

export type WithRefs<Record> = {
  [K in keyof Record]: Raw | Ref<string, Obj> | Record[K];
};

function mapColumn(value: Exclude<JSTypes, undefined>): DBTypes {
  if (isMoment(value)) {
    return value.toISOString();
  }
  return value;
}

export function intoDBTypes<T extends Record<string, JSTypes>>(data: T): Record<keyof T, DBTypes> {
  // @ts-ignore: Bad TypeScript.
  return Object.fromEntries(
    Object.entries(data)
      .filter(([_key, value]: [string, JSTypes]): boolean => value !== undefined)
      // @ts-ignore: TypeScript can't track the filtering above.
      .map(([key, value]: [string, Exclude<JSTypes, undefined>]): [string, DBTypes] => {
        return [key, mapColumn(value)];
      }),
  );
}
