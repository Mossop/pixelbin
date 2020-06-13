import { Server } from "net";

export type MakeRequired<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;
export type MakeOptional<T, K extends keyof T> = Partial<Pick<T, K>> & Omit<T, K>;

export function listen(server: Server, source: unknown): Promise<void> {
  return new Promise((resolve: () => void): void => {
    server.listen(source, resolve);
  });
}
