import type { Comparator } from "../../utils/sort";
import { reversed, binarySearch, numberComparator } from "../../utils/sort";
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
  renderHeader: () => React.ReactNode;
  readonly media: T[];
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

export const groupByYear: MediaGrouper = <T extends BaseMediaState>(
  media: readonly T[],
  comparator: MediaComparator,
): MediaGroup<T>[] => {
  let years: number[] = [];
  let yearComparator = reversed(numberComparator);

  let yearMap = new Map<number, MediaGroup<T>>();
  for (let item of media) {
    let { year } = mediaDate(item);

    let group = upsert(yearMap, year, (): MediaGroup<T> => {
      let position = binarySearch(years, year, yearComparator);
      years.splice(position, 0, year);

      return {
        id: `year${year}`,
        renderHeader: () => year,
        media: [],
      };
    });

    insertMedia(group.media, item, comparator);
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return years.map((year: number): MediaGroup<T> => yearMap.get(year)!);
};

export enum Grouping {
  Year = "year",
}

export enum Ordering {
  Date = "date",
}

const Groupers: Record<Grouping, MediaGrouper> = {
  [Grouping.Year]: groupByYear,
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
