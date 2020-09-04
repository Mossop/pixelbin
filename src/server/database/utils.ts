import Knex from "knex";

import { ObjectModel } from "../../model";
import { Table, COLUMNS } from "./types";

export function filterColumns<T extends Table.Media, D>(table: T, data: D): D {
  let allowed = COLUMNS[table];
  return Object.fromEntries(Object.entries(data).filter(([key]: [string, unknown]): boolean => {
    return allowed.includes(key);
  })) as unknown as D;
}

export function rowFromLocation(
  knex: Knex,
  location: ObjectModel.Location | null | undefined,
): Knex.Raw {
  if (!location) {
    return knex.raw("NULL::location");
  }

  return knex.raw("ROW(?, ?, ?, ?)::location", [
    location.left,
    location.right,
    location.top,
    location.bottom,
  ]);
}
