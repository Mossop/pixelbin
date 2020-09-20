import { Draft } from "immer";

import { listAlbumMedia } from "../api/album";
import { MediaState } from "../api/types";
import services from "../services";
import actions from "../store/actions";
import { MediaLookup, MediaLookupType } from "../store/types";

class MediaManager {
  private lookup: MediaLookup | null = null;

  private async updateMedia(lookup: MediaLookup, media: Draft<MediaState>[]): Promise<void> {
    if (lookup !== this.lookup) {
      return;
    }

    let store = await services.store;
    store.dispatch(actions.listedMedia(media));
  }

  private async doLookup(): Promise<void> {
    let lookup = this.lookup;
    if (!lookup) {
      return;
    }

    switch (lookup.type) {
      case MediaLookupType.Album: {
        return this.updateMedia(lookup, await listAlbumMedia(lookup.album, lookup.recursive));
        break;
      }
    }
  }

  public lookupMedia(lookup: MediaLookup): void {
    this.lookup = lookup;
    void this.doLookup();
  }
}

export default new MediaManager();
