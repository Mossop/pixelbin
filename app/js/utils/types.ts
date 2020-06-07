// eslint-disable-next-line @typescript-eslint/ban-types
export type Obj = {};
export type Func<A extends unknown[] = unknown[], R = unknown> = (...args: A) => R;
