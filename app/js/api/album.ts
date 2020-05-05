import type { Patch } from "./helpers";
import type { Album, Reference, Media } from "./highlevel";
import { ApiMethod, request } from "./types";
import type { AlbumCreateData, AlbumData } from "./types";

export function createAlbum(data: AlbumCreateData): Promise<AlbumData> {
  return request(ApiMethod.AlbumCreate, data);
}

export function editAlbum(album: Patch<AlbumCreateData, Album>): Promise<AlbumData> {
  return request(ApiMethod.AlbumEdit, album);
}

export function addMediaToAlbum(
  album: Reference<Album>,
  media: Reference<Media>[],
): Promise<AlbumData> {
  return request(ApiMethod.AlbumAddMedia, {
    album,
    media,
  });
}

export function removeMediaFromAlbum(
  album: Reference<Album>,
  media: Reference<Media>[],
): Promise<AlbumData> {
  return request(ApiMethod.AlbumRemoveMedia, {
    album,
    media,
  });
}
