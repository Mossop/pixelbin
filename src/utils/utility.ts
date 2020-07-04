import { Server } from "net";

export type MakeRequired<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;
export type MakeOptional<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

// eslint-disable-next-line @typescript-eslint/ban-types
export type Obj = {};
export type Func<A extends unknown[] = unknown[], R = unknown> = (...args: A) => R;

export type Primitive = string | number | symbol | undefined | null;

export function listen(server: Server, source: unknown): Promise<void> {
  return new Promise((resolve: () => void): void => {
    server.listen(source, resolve);
  });
}

export function bound<I>(methods: I, base: unknown): I {
  let entries = Object.entries(methods).map(
    // @ts-ignore: Object.entries is not well typed.
    <K extends keyof I>([key, member]: [K, I[K]]): [K, I[K]] => {
      if (typeof member == "function") {
        return [key, member.bind(base)];
      } else {
        return [key, member];
      }
    },
  );

  // @ts-ignore: Object.entries is not well typed.
  return Object.fromEntries(entries);
}
