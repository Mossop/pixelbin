export interface Mappable {
  id: string;
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

export interface Mapped<R extends Mappable> {
  [key: string]: R;
}

export function mapValues<R extends Mappable>(map: Mapped<R> | R[]): R[] {
  return Object.values(map).filter((item: R | undefined): item is R => !!item);
}

export function mapKeys<R extends Mappable>(map: Mapped<R> | R[]): string[] {
  return mapValues(map).map((item: R) => item.id);
}

export function mapEntries<R extends Mappable>(map: Mapped<R> | R[]): [string, R][] {
  return mapValues(map).map((item: R) => [item.id, item]);
}
