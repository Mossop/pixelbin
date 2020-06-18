export interface Mappable {
  id: string;
}

export type MapId<T extends Mappable> = T | string;

export type MapOf<R> = Map<string, R>;
export interface ReadonlyMapOf<R> extends ReadonlyMap<string, R> {}
export type MapType<M> = M extends MapOf<infer T> ? T : never;

export function intoId<T extends Mappable>(item: MapId<T>): string {
  if (typeof item == "string") {
    return item;
  }

  return item.id;
}

export function intoMap<T extends Mappable>(items: Iterable<T>): MapOf<T> {
  let result: MapOf<T> = new Map();
  for (let item of items) {
    result.set(item.id, item);
  }
  return result;
}
