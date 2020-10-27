import type { Draft } from "immer";

import type { Api } from "../../model";
import { Method, RelationType } from "../../model";
import { request } from "./api";
import type { Album, Reference, Media } from "./highlevel";
import type { AlbumState, Create, Patch, MediaState } from "./types";
import { albumIntoState, mediaIntoState } from "./types";

export function createAlbum(album: Create<AlbumState>): Promise<AlbumState> {
  return request(Method.AlbumCreate, {
    ...album,
    catalog: album.catalog.id,
    parent: album.parent?.id ?? null,
  }).then(albumIntoState);
}

export function editAlbum(album: Patch<AlbumState>): Promise<AlbumState> {
  let { id, parent, ...rest } = album;
  let data: Api.Patch<Api.Album> = {
    id: id.id,
    ...rest,
  };

  if (parent !== undefined) {
    data.parent = parent?.id ?? null;
  }

  return request(Method.AlbumEdit, data).then(albumIntoState);
}

export function deleteAlbum(album: Reference<Album>): Promise<void> {
  return request(Method.AlbumDelete, [album.id]);
}

export async function addMediaToAlbum(
  album: Reference<Album>,
  media: Reference<Media>[],
): Promise<void> {
  await request(Method.MediaRelations, [{
    operation: "add",
    type: RelationType.Album,
    media: media.map((m: Reference<Media>): string => m.id),
    items: [album.id],
  }]);
}

export async function removeMediaFromAlbum(
  album: Reference<Album>,
  media: Reference<Media>[],
): Promise<void> {
  await request(Method.MediaRelations, [{
    operation: "delete",
    type: RelationType.Album,
    media: media.map((m: Reference<Media>): string => m.id),
    items: [album.id],
  }]);
}

export async function listAlbumMedia(
  album: Reference<Album>,
  recursive: boolean,
): Promise<Draft<MediaState>[]> {
  let media = await request(Method.AlbumList, {
    id: album.id,
    recursive,
  });

  return media.map(mediaIntoState);
}
