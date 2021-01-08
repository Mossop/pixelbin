import type { Comparator } from "../../utils/sort";
import { keyedComparator, reversed, binarySearch, numberComparator } from "../../utils/sort";
import { upsert } from "../../utils/utility";
import type { BaseMediaState } from "../api/types";
import { mediaDate } from "./metadata";

export type MediaComparator = Comparator<BaseMediaState>;
export type MediaGrouper = <T extends BaseMediaState>(
  media: readonly T[],
  comparator: MediaComparator,
) => MediaGroup<T>[];

export interface MediaGroup<T extends BaseMediaState> {
  readonly id: string;
  readonly media: T[];
  readonly renderHeader: () => React.ReactNode;
}

function insertMedia<T extends BaseMediaState>(
  items: T[],
  media: T,
  comparator: MediaComparator,
): void {
  let position = binarySearch(items, media, comparator);
  items.splice(position, 0, media);
}

export const dateComparator: MediaComparator = (a: BaseMediaState, b: BaseMediaState): number => {
  return mediaDate(b).valueOf() - mediaDate(a).valueOf();
};

function buildGroupings<T extends BaseMediaState, G extends Omit<MediaGroup<T>, "media">>(
  mediaList: readonly T[],
  mediaComparator: MediaComparator,
  grouper: (media: T) => G,
  groupComparator: Comparator<G>,
): MediaGroup<T>[] {
  let groupMap = new Map<string, G>();
  let groupMediaMap = new Map<G, T[]>();

  for (let media of mediaList) {
    let group = grouper(media);
    let singletonGroup = upsert(groupMap, group.id, () => group);
    let groupMedia = upsert(groupMediaMap, singletonGroup, (): T[] => []);
    insertMedia(groupMedia, media, mediaComparator);
  }

  let sorted = [...groupMediaMap.entries()];
  sorted.sort(([groupA]: [G, T[]], [groupB]: [G, T[]]) => groupComparator(groupA, groupB));

  return sorted.map(([group, media]: [G, T[]]): MediaGroup<T> => ({
    id: group.id,
    renderHeader: () => group.renderHeader(),
    media,
  }));
}

export const groupByYear: MediaGrouper = <T extends BaseMediaState>(
  media: readonly T[],
  comparator: MediaComparator,
): MediaGroup<T>[] => {
  type Group = Omit<MediaGroup<T>, "media"> & {
    value: number;
  };
  let groupMap = new Map<number, Group>();

  return buildGroupings<T, Group>(
    media,
    comparator,
    (media: T): Group => {
      let { year: value } = mediaDate(media);
      return upsert(groupMap, value, (): Group => ({
        id: String(value),
        value: value,
        renderHeader: () => value,
      }));
    },
    reversed(keyedComparator("value", numberComparator)),
  );
};

export const groupByMonth: MediaGrouper = <T extends BaseMediaState>(
  media: readonly T[],
  comparator: MediaComparator,
): MediaGroup<T>[] => {
  type Group = Omit<MediaGroup<T>, "media"> & {
    value: number;
  };
  let groupMap = new Map<number, Group>();

  return buildGroupings<T, Group>(
    media,
    comparator,
    (media: T): Group => {
      let date = mediaDate(media);
      let { year, month } = date;
      let value = year * 12 + month - 1;
      return upsert(groupMap, value, (): Group => ({
        id: String(value),
        value,
        renderHeader: () => date.toLocaleString({
          year: "numeric",
          month: "long",
        }),
      }));
    },
    reversed(keyedComparator("value", numberComparator)),
  );
};

export enum Grouping {
  Year = "year",
  Month = "month",
}

export enum Ordering {
  Date = "date",
}

const Groupers: Record<Grouping, MediaGrouper> = {
  [Grouping.Year]: groupByYear,
  [Grouping.Month]: groupByMonth,
};

const Sorters: Record<Ordering, MediaComparator> = {
  [Ordering.Date]: dateComparator,
};

export function groupMedia<T extends BaseMediaState>(
  grouping: Grouping,
  reversedGrouping: boolean,
  ordering: Ordering,
  reverseOrder: boolean,
  media: readonly T[],
): MediaGroup<T>[] {
  let results = Groupers[grouping](
    media,
    reverseOrder ? reversed(Sorters[ordering]) : Sorters[ordering],
  );

  return reversedGrouping ? results.reverse() : results;
}

export function orderMedia<T extends BaseMediaState>(
  ordering: Ordering,
  reverseOrder: boolean,
  media: T[],
): T[] {
  let comparator = reverseOrder ? reversed(Sorters[ordering]) : Sorters[ordering];

  let results: T[] = [];
  for (let item of media) {
    insertMedia(results, item, comparator);
  }
  return results;
}
