import { Table, COLUMNS } from "./types";

export function filterColumns<T extends Table.Media, D>(table: T, data: D): D {
  let allowed = COLUMNS[table];
  return Object.fromEntries(Object.entries(data).filter(([key]: [string, unknown]): boolean => {
    return allowed.includes(key);
  })) as unknown as D;
}
