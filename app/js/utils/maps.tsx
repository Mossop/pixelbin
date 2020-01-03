export interface Mappable {
  readonly id: string;
}

export type MapId<R> = R | string;

export function intoId<R extends Mappable>(item: MapId<R>): string {
  if (typeof item === "string") {
    return item;
  }
  return item.id;
}

export function intoIds<R extends Mappable>(items: MapId<R>[]): string[] {
  return items.map(intoId);
}

export type MapOf<R extends Mappable> = ReadonlyMap<string, R>;

export function mapValues<R extends Mappable>(map: MapOf<R> | R[]): R[] {
  if (map instanceof Map) {
    return Array.from(map.values());
  }
  return Object.values(map);
}

export function mapKeys<R extends Mappable>(map: MapOf<R> | R[]): string[] {
  return mapValues(map).map((item: R) => item.id);
}

export function mapEntries<R extends Mappable>(map: MapOf<R> | R[]): [string, R][] {
  return mapValues(map).map((item: R) => [item.id, item]);
}

export function mapIncludes<R extends Mappable>(map: MapOf<R> | R[], item: MapId<R>): boolean {
  if (map instanceof Map) {
    return map.has(intoId(item));
  }

  return mapKeys(map).includes(intoId(item));
}