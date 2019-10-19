import { Mapped } from "./decoders";

type Comparator<A> = (a: A, b: A) => number;

export function sorted<A, K extends keyof A>(map: Mapped<A> | A[], key: K, comparator: Comparator<A[K]>): A[] {
  let results = Object.values(map);
  results.sort((a: A, b: A): number => {
    return comparator(a[key], b[key]);
  });
  return results;
}

export function nameSorted<A extends { name: string }>(map: Mapped<A> | A[]): A[] {
  return sorted(map, "name", (a: string, b: string) => a.localeCompare(b));
}
