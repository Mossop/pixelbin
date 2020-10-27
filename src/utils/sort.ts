import type { Obj } from "./utility";

type Comparator<A> = (a: A, b: A) => number;

export function sorted<A extends Obj, K extends keyof A>(
  items: A[],
  key: K,
  comparator: Comparator<A[K]>,
): A[] {
  let results = Array.from(items);
  results.sort((a: A, b: A): number => {
    return comparator(a[key], b[key]);
  });
  return results;
}

type StringProps<A> = {
  [K in keyof A]: A[K] extends string ? K : never;
}[keyof A];

export function stringSorted<
  A extends Obj,
  K extends StringProps<A>,
>(items: A[], key: K): A[] {
  // @ts-ignore
  return sorted(items, key, (a: string, b: string): number => a.localeCompare(b));
}

export function idSorted<A extends { id: string }>(items: A[]): A[] {
  // @ts-ignore
  return stringSorted(items, "id");
}

export function nameSorted<A extends { name: string }>(items: A[]): A[] {
  // @ts-ignore
  return stringSorted(items, "name");
}
