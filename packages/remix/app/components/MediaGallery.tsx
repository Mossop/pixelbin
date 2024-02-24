"use client";

import { produce } from "immer";
import { NdjsonStream } from "ndjson-stream";
import {
  Dispatch,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ApiMediaView, MediaView } from "@/modules/types";
import { deserializeMediaView, mediaDate } from "@/modules/util";

export type GalleryType = "album" | "catalog" | "search";

export interface Group {
  id: string;
  title: string;
  media: MediaView[];
}

interface Context {
  readonly base: string[];
  readonly groups: readonly Group[] | null;
  readonly media: readonly MediaView[] | null;
}

interface GroupContext {
  readonly groups: readonly Group[];
  readonly media: readonly MediaView[];
}

abstract class Grouper {
  public context: GroupContext;

  public constructor() {
    this.context = { media: [], groups: [] };
  }

  protected abstract idFor(media: MediaView): string;

  protected abstract titleFor(media: MediaView): string;

  public addMedia(list: MediaView[]) {
    if (!list.length) {
      return;
    }

    this.context = produce(this.context, (context) => {
      let currentGroup = context.groups[context.groups.length - 1];

      for (let media of list) {
        let groupId = this.idFor(media);

        if (currentGroup?.id === groupId) {
          currentGroup.media.push(media);
        } else {
          currentGroup = {
            id: groupId,
            title: this.titleFor(media),
            media: [media],
          };

          context.groups.push(currentGroup);
        }

        context.media.push(...list);
      }
    });
  }
}

class TakenGrouper extends Grouper {
  protected idFor(media: MediaView): string {
    let dt = mediaDate(media);
    return dt ? (dt.month - 1 + dt.year * 12).toString() : "";
  }

  protected titleFor(media: MediaView): string {
    let dt = mediaDate(media);
    return dt ? `${dt.monthLong} ${dt.year}` : "";
  }
}

const GalleryContext = createContext<Context>({
  base: [],
  groups: null,
  media: null,
});

export function useGalleryMedia(): MediaView[] | null {
  let { media } = useContext(GalleryContext);
  return media?.slice() ?? null;
}

export function useGalleryGroups(): Group[] | null {
  let { groups } = useContext(GalleryContext);
  return groups?.slice() ?? null;
}

export function useGalleryBase(): string[] {
  return useContext(GalleryContext).base;
}

function fetchMedia(
  type: string,
  id: string,
  setContext: Dispatch<GroupContext>,
): () => void {
  let aborter = new AbortController();

  fetch(`/api/${type}/${id}/media`, { signal: aborter.signal })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        return;
      }

      let grouper = new TakenGrouper();

      let jsonStream = new NdjsonStream<ApiMediaView[]>();
      let reader = response.body.pipeThrough(jsonStream).getReader();

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        grouper.addMedia(value.map(deserializeMediaView));
        setContext(grouper.context);
      }
    })
    .catch((error) => {
      if (error instanceof DOMException && error.name == "AbortError") {
        // Component remounted
      } else {
        console.error(error);
      }
    });

  return () => {
    aborter.abort();
  };
}

export default function MediaGallery({
  children,
  type,
  id,
}: {
  children: React.ReactNode;
  type: GalleryType;
  id: string;
}) {
  let [context, setContext] = useState<Omit<Context, "base">>({
    media: null,
    groups: null,
  });
  useEffect(() => fetchMedia(type, id, setContext), [type, id]);

  let gallery = useMemo(
    () => ({ base: [type, id], ...context }),
    [type, id, context],
  );

  return (
    <GalleryContext.Provider value={gallery}>
      {children}
    </GalleryContext.Provider>
  );
}
