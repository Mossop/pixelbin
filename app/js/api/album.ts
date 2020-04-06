import { request } from "./api";
import { Patch } from "./helpers";
import { Album, Reference, Media } from "./highlevel";
import { AlbumCreateData, ApiMethod, AlbumData } from "./types";

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
