import type { Obj } from "./utility";

export type Comparator<A> = (a: A, b: A) => number;

export const stringComparator = (a: string, b: string): number => a.localeCompare(b);
export const numberComparator = (a: number, b: number): number => a - b;
export function nullFirst<T>(inner: Comparator<T>): Comparator<T | null | undefined> {
  return (a: T| null | undefined, b: T| null | undefined): number => {
    if (a === null || a === undefined) {
      if (b === null || b === undefined) {
        return 0;
      }

      return -1;
    }

    if (b === null || b === undefined) {
      return 1;
    }

    return inner(a, b);
  };
}
export function reversed<T>(inner: Comparator<T>): Comparator<T> {
  return (a: T, b: T) => -inner(a, b);
}

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
  return sorted(items, key, stringComparator);
}

export function idSorted<A extends { id: string }>(items: A[]): A[] {
  // @ts-ignore
  return stringSorted(items, "id");
}

export function nameSorted<A extends { name: string }>(items: A[]): A[] {
  // @ts-ignore
  return stringSorted(items, "name");
}

export function binarySearch<T>(items: readonly T[], item: T, comparator: Comparator<T>): number {
  if (items.length == 0) {
    return 0;
  }

  let first = 0;
  let last = items.length - 1;
  while (first <= last) {
    // console.log("Compare loop start", items[first], items[last]);
    let compared = comparator(item, items[first]);
    // console.log("First result", compared);
    if (compared <= 0) {
      return first;
    }

    if (last == first) {
      return first + 1;
    }

    compared = comparator(item, items[last]);
    // console.log("Last result", compared);
    if (compared >= 0) {
      return last + 1;
    }

    let mid = Math.ceil((first + last) / 2);
    // console.log("Midpoint", items[mid]);
    if (mid == last) {
      return last;
    }

    compared = comparator(item, items[mid]);
    // console.log("Midpoint result", compared);
    if (compared == 0) {
      return mid;
    }
    if (compared < 0) {
      last = mid - 1;
      first++;
    } else {
      first = mid + 1;
      last--;
    }
  }

  return first;
}
