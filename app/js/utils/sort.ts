import { Catalog } from "../api/types";
import { mapValues, Mapped, Mappable } from "./maps";

type Comparator<A> = (a: A, b: A) => number;

export function sorted<A extends Mappable, K extends keyof A>(map: Mapped<A> | A[], key: K, comparator: Comparator<A[K]>): A[] {
  let results = Object.values(map);
  results.sort((a: A, b: A): number => {
    return comparator(a[key], b[key]);
  });
  return results;
}

export function nameSorted<A extends Mappable & { name: string }>(map: Mapped<A> | A[]): A[] {
  return sorted(map, "name", (a: string, b: string) => a.localeCompare(b));
}

export function catalogNameSorted(map: Mapped<Catalog> | Catalog[]): Catalog[] {
  let results = mapValues(map);
  results.sort((a: Catalog, b: Catalog) => {
    return a.root.name.localeCompare(b.root.name);
  });
  return results;
}
