export interface Mappable {
  id: string;
}

export function isId<T extends Mappable>(item: MapId<T>): item is string {
  return typeof item == "string";
}

export function isInstance<T extends Mappable>(item: MapId<T>): item is T {
  return !isId(item);
}

export type MapId<T extends Mappable> = T | string;

export type MapOf<R extends Mappable> = Map<string, R>;
export type MapType<M> = M extends MapOf<infer T> ? T : never;

export function intoId<T extends Mappable>(item: MapId<T>): string {
  if (typeof item == "string") {
    return item;
  }

  return item.id;
}

export function intoIds<T extends Mappable>(items: MapId<T>[]): string[] {
  return items.map(intoId);
}
