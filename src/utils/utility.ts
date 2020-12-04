export type Overwrite<A, B> = Omit<A, keyof B> & B;
export type MakeRequired<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;
export type MakeOptional<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;
export type MakeOptionalExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

// eslint-disable-next-line @typescript-eslint/ban-types
export interface Obj {}
export type Func<
  A extends unknown[] = unknown[],
  R = unknown,
  T = unknown,
> = (this: T, ...args: A) => R;

export type Primitive = string | number | symbol | undefined | null;

export type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

export type AllNull<T> = {
  [K in keyof T]: null;
};

type Bound<I> = {
  [K in keyof I]: OmitThisParameter<I[K]>;
};

export function bound<I>(methods: I, base: unknown): Bound<I> {
  let entries = Object.entries(methods).map(
    // @ts-ignore
    <K extends keyof I>([key, member]: [K, I[K]]): [K, I[K]] => {
      if (typeof member == "function") {
        return [key, member.bind(base)];
      } else {
        return [key, member];
      }
    },
  );

  // @ts-ignore
  return Object.fromEntries(entries);
}

export function entries<T, K extends keyof T = keyof T>(obj: T): [K, T[K]][] {
  return Object.entries(obj) as unknown as [K, T[K]][];
}

export function nullIfEmpty(val: string | null): string | null {
  return val ? val : null;
}

// function fromEntries<O, K extends keyof O = keyof O>(entries: [K, O[K]][]): O {
//   return Object.fromEntries(entries) as unknown as O;
// }

// type SharedKeys<O, R> = Extract<keyof O, keyof R>;
// function map<O, R>(obj: O, cb: <K extends SharedKeys<O, R>>(key: K, value: O[K]) => R[K]): R {
//   return fromEntries(entries(obj).map(cb));
// }

export function upsert<
  Key,
  Value,
  M extends Map<Key, Value>,
>(map: M, key: Key, gen: () => Value): Value {
  if (map.has(key)) {
    // @ts-ignore
    return map.get(key);
  }

  let value = gen();
  map.set(key, value);
  return value;
}

export function weakUpsert<
  Key extends Obj,
  Value,
  M extends WeakMap<Key, Value>,
>(map: M, key: Key, gen: () => Value): Value {
  if (map.has(key)) {
    // @ts-ignore
    return map.get(key);
  }

  let value = gen();
  map.set(key, value);
  return value;
}
