import { Draft } from "immer";

import { MediaState } from "../api/types";

export type MediaListRequestor = () => Promise<Draft<MediaState>[]> | Draft<MediaState>[];
export type MediaListHandler = (media: Draft<MediaState>[]) => void;
export type Cancel = () => void;

interface RequestRecord {
  handler: MediaListHandler;
  cancelled: boolean;
  currentList?: Draft<MediaState>[];
}

class MediaManager {
  private async startRequest(requestor: MediaListRequestor, record: RequestRecord): Promise<void> {
    let media = await requestor();
    if (!record.cancelled) {
      record.handler(media);
    }
  }

  public requestMediaList(requestor: MediaListRequestor, handler: MediaListHandler): Cancel {
    let record: RequestRecord = {
      handler,
      cancelled: false,
    };

    this.startRequest(requestor, record).catch((e: unknown) => console.error(e));

    return (): void => {
      record.cancelled = true;
    };
  }
}

export default new MediaManager();
