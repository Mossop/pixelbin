import { createContext, useContext, useMemo } from "react";

import { BaseContext, contextPropertyHook } from "@/modules/client-util";
import { MediaRelations, MediaView } from "@/modules/types";

export enum MediaType {
  Video,
  Photo,
}

export enum PlayState {
  Playing,
  Paused,
  Ended,
}

export interface VideoState {
  playState: PlayState;
  currentTime: number;
  duration: number;
}

export function typeForMedia(media: MediaView | null) {
  if (!media?.file) {
    return null;
  }

  return media.file.mimetype.startsWith("video/")
    ? MediaType.Video
    : MediaType.Photo;
}

class MediaContext extends BaseContext {
  currentMedia: MediaRelations | null = null;

  videoState: (VideoState & { element: HTMLVideoElement }) | null = null;

  get currentMediaType(): MediaType | null {
    return typeForMedia(this.currentMedia);
  }

  setMedia(media: MediaRelations | null) {
    if (this.currentMedia?.id === media?.id) {
      return;
    }

    this.currentMedia = media;
    this.videoState = null;
    this.changed();
  }

  updateVideoState(
    media: MediaRelations,
    state: VideoState,
    element: HTMLVideoElement,
  ) {
    if (media !== this.currentMedia) {
      return;
    }

    this.videoState = { ...state, element };
    this.changed();
  }

  play() {
    this.videoState?.element?.play();
  }

  pause() {
    this.videoState?.element?.pause();
  }

  togglePlayback() {
    if (!this.videoState) {
      return;
    }

    if (this.videoState.playState != PlayState.Playing) {
      this.play();
    } else {
      this.pause();
    }
  }
}

const Context = createContext(new MediaContext());

export function useMediaContext(): MediaContext {
  return useContext(Context);
}

export const useCurrentMedia = contextPropertyHook(
  useMediaContext,
  "currentMedia",
);

export const useVideoState = contextPropertyHook(useMediaContext, "videoState");

export default function Provider({ children }: { children: React.ReactNode }) {
  let mediaContext = useMemo(() => new MediaContext(), []);

  return <Context.Provider value={mediaContext}>{children}</Context.Provider>;
}
