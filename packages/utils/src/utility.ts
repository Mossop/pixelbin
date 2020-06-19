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
