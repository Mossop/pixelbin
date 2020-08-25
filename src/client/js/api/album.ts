import { Api } from "../../../model";
import { request } from "./api";
import { Album, Reference, Media } from "./highlevel";
import { AlbumState, Create, albumIntoState, Patch } from "./types";

export function createAlbum(album: Create<AlbumState>): Promise<AlbumState> {
  return request(Api.Method.AlbumCreate, {
    ...album,
    catalog: album.catalog.id,
    parent: album.parent?.id ?? null,
  }).then(albumIntoState);
}

export function editAlbum(album: Patch<AlbumState>): Promise<AlbumState> {
  return request(Api.Method.AlbumEdit, {
    ...album,
    id: album.id.id,
    parent: album.parent ? album.parent.id : undefined,
  }).then(albumIntoState);
}

export async function addMediaToAlbum(
  album: Reference<Album>,
  media: Reference<Media>[],
): Promise<void> {
  await request(Api.Method.MediaRelations, [{
    operation: "add",
    type: Api.RelationType.Album,
    media: media.map((m: Reference<Media>): string => m.id),
    items: [album.id],
  }]);
}

export async function removeMediaFromAlbum(
  album: Reference<Album>,
  media: Reference<Media>[],
): Promise<void> {
  await request(Api.Method.MediaRelations, [{
    operation: "delete",
    type: Api.RelationType.Album,
    media: media.map((m: Reference<Media>): string => m.id),
    items: [album.id],
  }]);
}
