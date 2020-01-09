import { Catalog } from "../api/highlevel";
import { MapOf } from "./maps";

type Comparator<A> = (a: A, b: A) => number;

function intoArray<A, B>(items: Map<B, A> | A[]): A[] {
  if (Array.isArray(items)) {
    return Array.from(items);
  }
  return Array.from(items.values());
}

export function sorted<A extends object, K extends keyof A, B>(items: Map<B, A> | A[], key: K, comparator: Comparator<A[K]>): A[] {
  let results = intoArray(items);
  results.sort((a: A, b: A): number => {
    return comparator(a[key], b[key]);
  });
  return results;
}

export function nameSorted<A extends { name: string }, B>(items: Map<B, A> | A[]): A[] {
  return sorted(items, "name", (a: string, b: string) => a.localeCompare(b));
}

export function catalogNameSorted(items: MapOf<Catalog> | Catalog[]): Catalog[] {
  let results = intoArray(items);
  results.sort((a: Catalog, b: Catalog) => {
    return a.root.name.localeCompare(b.root.name);
  });
  return results;
}
