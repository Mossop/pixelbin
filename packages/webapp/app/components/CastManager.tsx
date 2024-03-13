import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";

import { MediaView, MediaViewFile, Replace } from "../modules/types";
import { BaseContext, contextPropertyHook } from "@/modules/client-util";
import { url } from "@/modules/util";

import "styles/components/CastManager.scss";

type SessionStateEventData = cast.framework.SessionStateEventData;
type CastSession = cast.framework.CastSession;

type CastableMediaView = Replace<MediaView, { file: MediaViewFile }>;

function isCastable(media: MediaView | null): media is CastableMediaView {
  return media?.file !== null;
}

class CastManager extends BaseContext {
  castAvailable = false;

  castSession: CastSession | null = null;

  currentMedia: CastableMediaView | null = null;

  init() {
    if (this.castAvailable) {
      return;
    }

    this.castAvailable = true;

    this.updateSession(
      cast.framework.CastContext.getInstance().getCurrentSession(),
    );

    cast.framework.CastContext.getInstance().addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      (event: SessionStateEventData) => {
        this.updateSession(event.session);
      },
    );

    this.changed();
  }

  async loadMedia(media: CastableMediaView) {
    let mimetype;
    let urlMimetype;
    let extension;

    let { filename } = media;
    if (filename) {
      let pos = filename.lastIndexOf(".");
      if (pos > 0) {
        filename = filename.substring(0, pos);
      }
    }

    if (media.file.mimetype.startsWith("video/")) {
      mimetype = "video/mp4";
      urlMimetype = "video-mp4";
      extension = "mp4";

      if (!filename) {
        filename = "video";
      }
    } else {
      mimetype = "image/jpeg";
      urlMimetype = "image-jpeg";
      extension = "jpg";

      if (!filename) {
        filename = "image";
      }
    }

    let mediaUrl = url([
      "media",
      "encoding",
      media.id,
      media.file.id,
      urlMimetype,
      `${filename}.${extension}`,
    ]);

    let response = await fetch(mediaUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      let { url: targetUrl } = await response.json();

      if (media === this.currentMedia && this.castSession) {
        let mediaInfo = new chrome.cast.media.MediaInfo(targetUrl, mimetype);
        let request = new chrome.cast.media.LoadRequest(mediaInfo);
        try {
          await this.castSession.loadMedia(request);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  async stopMedia() {
    // TODO
  }

  updateSession(session: CastSession | null) {
    if (this.castSession === session) {
      return;
    }

    this.castSession = session;
    if (session && this.currentMedia) {
      this.loadMedia(this.currentMedia);
    }

    this.changed();
  }

  castMedia(media: MediaView | null) {
    if (media && isCastable(media)) {
      this.currentMedia = media;

      if (this.castSession) {
        this.loadMedia(media);
      }
    } else {
      this.currentMedia = null;

      if (this.castSession) {
        this.stopMedia();
      }
    }
  }
}

const ManagerContext = createContext(new CastManager());

export function useCastManager(): CastManager {
  return useContext(ManagerContext);
}

export const useCastAvailable = contextPropertyHook(
  useCastManager,
  "castAvailable",
);

export function CastButton() {
  let castAvailable = useCastAvailable();
  if (!castAvailable) {
    return null;
  }

  return (
    <div className="c-cast-button">
      {/* @ts-ignore */}
      <google-cast-launcher />
    </div>
  );
}

export default function Provider({ children }: { children: React.ReactNode }) {
  let castManager = useMemo(() => new CastManager(), []);

  let init = useCallback(() => castManager.init(), [castManager]);

  useEffect(() => {
    if (castManager.castAvailable) {
      return undefined;
    }

    // @ts-ignore
    if (window.castState) {
      init();

      return undefined;
    }

    document.addEventListener("cast-available", init, { once: true });

    return () => document.removeEventListener("cast-available", init);
  }, [init, castManager]);

  return (
    <ManagerContext.Provider value={castManager}>
      {children}
    </ManagerContext.Provider>
  );
}
