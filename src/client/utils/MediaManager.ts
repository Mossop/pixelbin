import { Draft } from "immer";

import { listAlbumMedia } from "../api/album";
import { getMedia } from "../api/media";
import { MediaState } from "../api/types";
import services from "../services";
import actions from "../store/actions";
import { MediaLookup, MediaLookupType } from "../store/types";

function isMedia(item: Draft<MediaState> | null): item is Draft<MediaState> {
  return !!item;
}

class MediaManager {
  private lookup: MediaLookup | null = null;

  private async doLookup(lookup: MediaLookup): Promise<Draft<MediaState>[]> {
    switch (lookup.type) {
      case MediaLookupType.Album: {
        return listAlbumMedia(lookup.album, lookup.recursive);
      }
      case MediaLookupType.Single: {
        let media = await getMedia([lookup.media]);
        return media.filter(isMedia);
      }
    }
  }

  public lookupMedia(lookup: MediaLookup): void {
    this.lookup = lookup;

    void this.doLookup(lookup).then(async (media: Draft<MediaState>[]): Promise<void> => {
      if (lookup !== this.lookup) {
        return;
      }

      let store = await services.store;
      store.dispatch(actions.listedMedia(media));
    });
  }

  public lookupsMatch(a: MediaLookup, b: MediaLookup): boolean {
    if (a.type != b.type) {
      return false;
    }

    if (a.type == MediaLookupType.Album && b.type == MediaLookupType.Album) {
      return a.album.id == b.album.id && a.recursive == b.recursive;
    }
    if (a.type == MediaLookupType.Single && b.type == MediaLookupType.Single) {
      return a.media == b.media;
    }

    return false;
  }
}

export default new MediaManager();
