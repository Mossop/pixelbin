"use client";

import { NdjsonStream } from "ndjson-stream";
import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ApiMediaView, MediaView } from "@/modules/types";
import { deserializeMediaView } from "@/modules/util";

export type GalleryType = "album" | "catalog" | "search";

interface Context {
  base: string[];
  media: MediaView[] | null;
}

const GalleryContext = createContext<Context>({ base: [], media: null });

export function useGalleryMedia(): MediaView[] | null {
  return useContext(GalleryContext).media?.slice() ?? null;
}

export function useGalleryBase(): string[] {
  return useContext(GalleryContext).base;
}

function fetchMedia(
  type: string,
  id: string,
  setMedia: Dispatch<SetStateAction<MediaView[] | null>>,
): () => void {
  let aborter = new AbortController();

  fetch(`/api/${type}/${id}/media`, { signal: aborter.signal }).then(
    async (response) => {
      if (!response.ok || !response.body) {
        return;
      }

      let jsonStream = new NdjsonStream<ApiMediaView[]>();
      let reader = response.body.pipeThrough(jsonStream).getReader();

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        let newMedia = value.map(deserializeMediaView);
        setMedia((currentMedia) =>
          currentMedia ? currentMedia.concat(newMedia) : newMedia,
        );
      }
    },
  );

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
  let [media, setMedia] = useState<MediaView[] | null>(null);
  useEffect(() => fetchMedia(type, id, setMedia), [type, id]);

  let gallery = useMemo(() => ({ base: [type, id], media }), [type, id, media]);

  return (
    <GalleryContext.Provider value={gallery}>
      {children}
    </GalleryContext.Provider>
  );
}
