import type { Draft } from "immer";

import type { Api } from "../../model";
import { Method } from "../../model";
import { request } from "./api";
import type { Reference } from "./highlevel";
import { Catalog, Person, Tag, Album } from "./highlevel";
import type {
  MediaAlbumState,
  MediaPersonState,
  MediaRelations,
  MediaState,
  MediaTagState,
  ServerState,
} from "./types";
import { mediaIntoState } from "./types";

export type MediaTarget = Catalog | Album;

export function mediaTargetDeref(
  ref: Reference<Catalog> | Reference<Album> | Reference<MediaTarget>,
  serverState: ServerState,
): MediaTarget {
  let catalog = Catalog.safeFromState(serverState, ref as unknown as string);
  if (catalog) {
    return catalog;
  }

  return Album.fromState(serverState, ref as unknown as string);
}

export async function getMedia(ids: string[]): Promise<(Draft<MediaState> | null)[]> {
  let media = await request(Method.MediaGet, {
    id: ids.join(","),
  });
  return Promise.all(media.map((media: Api.Media | null): Promise<Draft<MediaState> | null> => {
    if (media) {
      return mediaIntoState(media);
    }
    return Promise.resolve(null);
  }));
}

export async function getMediaRelations(ids: string[]): Promise<(Draft<MediaRelations> | null)[]> {
  let relations = await request(Method.MediaRelationsGet, {
    id: ids.join(","),
  });

  return relations.map((relation: Api.MediaRelations | null): Draft<MediaRelations> | null => {
    if (!relation) {
      return null;
    }

    return {
      albums: relation.albums.map((value: Api.MediaAlbum): MediaAlbumState => ({
        album: Album.ref(value.album),
      })),
      tags: relation.tags.map((value: Api.MediaTag): MediaTagState => ({
        tag: Tag.ref(value.tag),
      })),
      people: relation.people.map((value: Api.MediaPerson): MediaPersonState => ({
        person: Person.ref(value.person),
        location: value.location,
      })),
    };
  });
}
