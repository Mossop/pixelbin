import type { Draft } from "immer";

import { Method, RelationType } from "../../model";
import { request } from "./api";
import type { Album, Reference, Media, Catalog } from "./highlevel";
import { refId } from "./highlevel";
import type { AlbumState, MediaState } from "./types";
import { albumIntoState, mediaIntoState } from "./types";

export function createAlbum(
  catalog: Reference<Catalog>,
  album: Omit<AlbumState, "id" | "catalog">,
): Promise<Draft<AlbumState>> {
  return request(Method.AlbumCreate, {
    catalog: refId(catalog),
    album: {
      ...album,
      parent: album.parent ? refId(album.parent) : null,
    },
  }).then(albumIntoState);
}

export function editAlbum(
  album: Reference<Album>,
  updates: Partial<Omit<AlbumState, "id" | "catalog">>,
): Promise<Draft<AlbumState>> {
  return request(Method.AlbumEdit, {
    id: refId(album),
    album: {
      ...updates,
      parent: updates.parent ? refId(updates.parent) : updates.parent,
    },
  }).then(albumIntoState);
}

export function deleteAlbum(album: Reference<Album>): Promise<void> {
  return request(Method.AlbumDelete, [refId(album)]);
}

export async function addMediaToAlbum(
  album: Reference<Album>,
  media: Reference<Media>[],
): Promise<void> {
  await request(Method.MediaRelations, [{
    operation: "add",
    type: RelationType.Album,
    media: media.map(refId),
    items: [refId(album)],
  }]);
}

export async function removeMediaFromAlbum(
  album: Reference<Album>,
  media: Reference<Media>[],
): Promise<void> {
  await request(Method.MediaRelations, [{
    operation: "delete",
    type: RelationType.Album,
    media: media.map(refId),
    items: [refId(album)],
  }]);
}

export async function listAlbumMedia(
  album: Reference<Album>,
  recursive: boolean,
): Promise<Draft<MediaState>[]> {
  let media = await request(Method.AlbumList, {
    id: refId(album),
    recursive,
  });

  return Promise.all(media.map(mediaIntoState));
}
