import { NdjsonStream } from "ndjson-stream";
import {
  Dispatch,
  createContext,
  useCallback,
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
  readonly url: string;
  readonly groups: readonly Group[];
  readonly media: readonly MediaView[];
  readonly getMediaUrl?: (id: string) => string;
}

interface GroupContext {
  readonly groups: Group[];
  readonly media: MediaView[];
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

    let { media, groups } = this.context;

    let wasLast = true;
    let currentGroup = groups.pop();

    let pushCurrent = () => {
      wasLast = false;

      if (!currentGroup) {
        return;
      }

      groups.push({
        ...currentGroup,
      });

      currentGroup = undefined;
    };

    for (let item of list) {
      let groupId = this.idFor(item);

      if (currentGroup?.id === groupId) {
        if (wasLast) {
          currentGroup = {
            ...currentGroup,
            media: [...currentGroup.media, item],
          };

          wasLast = false;
        } else {
          currentGroup.media.push(item);
        }
      } else {
        pushCurrent();

        currentGroup = {
          id: groupId,
          title: this.titleFor(item),
          media: [item],
        };
      }
    }

    pushCurrent();

    this.context = { media: [...media, ...list], groups: [...groups] };
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
  url: "",
  groups: [],
  media: [],
  getMediaUrl: undefined,
});

export function useGalleryMedia(): readonly MediaView[] | null {
  let { media } = useContext(GalleryContext);
  return media ?? null;
}

export function useGalleryGroups(): readonly Group[] | null {
  let { groups } = useContext(GalleryContext);
  return groups ?? null;
}

export function useGalleryUrl(): string {
  return useContext(GalleryContext).url;
}

export function useGetMediaUrl(): (id: string) => string {
  let context = useContext(GalleryContext);

  return useCallback(
    (mediaId: string) => {
      if (context.getMediaUrl) {
        return context.getMediaUrl(mediaId);
      }

      return `${context.url}/media/${encodeURIComponent(mediaId)}`;
    },
    [context],
  );
}

function fetchMedia(
  requestStream: (signal: AbortSignal) => Promise<Response>,
  setContext: Dispatch<GroupContext>,
): () => void {
  let aborter = new AbortController();

  requestStream(aborter.signal)
    .then(async (response) => {
      if (!response.ok || !response.body) {
        return;
      }

      let grouper = new TakenGrouper();

      let jsonStream = new NdjsonStream<ApiMediaView[]>();
      let reader = response.body
        .pipeThrough(jsonStream, {
          signal: aborter.signal,
        })
        .getReader();

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
  requestStream,
  url,
  getMediaUrl,
}: {
  children: React.ReactNode;
  requestStream: (signal: AbortSignal) => Promise<Response>;
  url: string;
  getMediaUrl?: (id: string) => string;
}) {
  let [context, setContext] = useState<GroupContext>({
    media: [],
    groups: [],
  });
  useEffect(() => fetchMedia(requestStream, setContext), [requestStream]);

  let gallery = useMemo(
    () => ({ url, getMediaUrl, ...context }),
    [url, getMediaUrl, context],
  );

  return (
    <GalleryContext.Provider value={gallery}>
      {children}
    </GalleryContext.Provider>
  );
}
